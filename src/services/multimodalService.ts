import { VertexAI } from '@google-cloud/vertexai';
import { config } from '../config';

export interface DocumentExtractionResult {
  documentType: 'passport' | 'id' | 'boarding_pass' | 'visa' | 'unknown';
  extractedData: any;
  confidence: number;
  validationErrors: string[];
  warnings: string[];
}

export interface PassportData {
  passportNumber: string;
  firstName: string;
  lastName: string;
  nationality: string;
  dateOfBirth: string;
  expiryDate: string;
  issuingCountry: string;
  gender?: string;
}

export interface BoardingPassData {
  passengerName: string;
  flightNumber: string;
  airline: string;
  origin: string;
  destination: string;
  departureDate: string;
  departureTime: string;
  seat: string;
  gate?: string;
  boardingTime?: string;
  confirmationCode: string;
}

export class MultimodalService {
  private vertexAI: VertexAI;
  private visionModel: any;

  constructor() {
    this.vertexAI = new VertexAI({
      project: config.googleCloud.projectId,
      location: config.googleCloud.location
    });
  }

  /**
   * Initialize the vision model
   */
  async initialize(): Promise<void> {
    try {
      this.visionModel = this.vertexAI.preview.getGenerativeModel({
        model: 'gemini-1.5-pro-vision'
      });
      console.log('✅ Multimodal service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize multimodal service:', error);
      throw error;
    }
  }

  /**
   * Extract information from travel document image
   */
  async extractDocumentInfo(
    imageData: string,
    documentType?: 'passport' | 'id' | 'boarding_pass' | 'visa'
  ): Promise<DocumentExtractionResult> {
    try {
      if (!this.visionModel) {
        await this.initialize();
      }

      const prompt = this.buildExtractionPrompt(documentType);

      const result = await this.visionModel.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: imageData
                }
              }
            ]
          }
        ]
      });

      const response = result.response.candidates[0].content.parts[0].text;
      return this.parseExtractionResponse(response, documentType);
    } catch (error) {
      console.error('❌ Document extraction failed:', error);
      throw error;
    }
  }

  /**
   * Validate passport information
   */
  async validatePassport(passportData: PassportData): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    if (!passportData.passportNumber) {
      errors.push('Passport number is required');
    }
    if (!passportData.firstName || !passportData.lastName) {
      errors.push('Full name is required');
    }
    if (!passportData.dateOfBirth) {
      errors.push('Date of birth is required');
    }
    if (!passportData.expiryDate) {
      errors.push('Expiry date is required');
    }

    // Validate expiry date
    if (passportData.expiryDate) {
      const expiryDate = new Date(passportData.expiryDate);
      const now = new Date();
      const sixMonthsFromNow = new Date();
      sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);

      if (expiryDate < now) {
        errors.push('Passport has expired');
      } else if (expiryDate < sixMonthsFromNow) {
        warnings.push('Passport expires within 6 months - some countries require 6+ months validity');
      }
    }

    // Validate passport number format (basic check)
    if (passportData.passportNumber && !/^[A-Z0-9]{6,9}$/.test(passportData.passportNumber)) {
      warnings.push('Passport number format may be invalid');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Extract boarding pass information
   */
  async extractBoardingPass(imageData: string): Promise<BoardingPassData> {
    try {
      const result = await this.extractDocumentInfo(imageData, 'boarding_pass');
      
      if (result.documentType !== 'boarding_pass') {
        throw new Error('Image does not appear to be a boarding pass');
      }

      return result.extractedData as BoardingPassData;
    } catch (error) {
      console.error('❌ Boarding pass extraction failed:', error);
      throw error;
    }
  }

  /**
   * Verify boarding pass matches booking
   */
  async verifyBoardingPass(
    boardingPassData: BoardingPassData,
    bookingData: any
  ): Promise<{
    matches: boolean;
    discrepancies: string[];
  }> {
    const discrepancies: string[] = [];

    // Check flight number
    if (boardingPassData.flightNumber !== bookingData.flightNumber) {
      discrepancies.push(`Flight number mismatch: ${boardingPassData.flightNumber} vs ${bookingData.flightNumber}`);
    }

    // Check passenger name
    const bookingName = `${bookingData.firstName} ${bookingData.lastName}`.toUpperCase();
    if (!boardingPassData.passengerName.includes(bookingName)) {
      discrepancies.push('Passenger name does not match booking');
    }

    // Check route
    if (boardingPassData.origin !== bookingData.origin || 
        boardingPassData.destination !== bookingData.destination) {
      discrepancies.push('Route does not match booking');
    }

    // Check date
    const boardingDate = new Date(boardingPassData.departureDate);
    const bookingDate = new Date(bookingData.departureDate);
    if (boardingDate.toDateString() !== bookingDate.toDateString()) {
      discrepancies.push('Departure date does not match booking');
    }

    return {
      matches: discrepancies.length === 0,
      discrepancies
    };
  }

  /**
   * Analyze flight ticket image for details
   */
  async analyzeTicketImage(imageData: string): Promise<{
    flightDetails: any;
    recommendations: string[];
    warnings: string[];
  }> {
    try {
      if (!this.visionModel) {
        await this.initialize();
      }

      const prompt = `Analyze this flight ticket or itinerary image and extract all relevant information.

Provide:
1. Flight details (airline, flight number, route, dates, times)
2. Passenger information
3. Booking reference/confirmation code
4. Fare class and ticket type
5. Any special services or notes
6. Baggage allowance if visible

Also provide:
- Recommendations for the traveler
- Any warnings or important notices

Format as JSON with clear structure.`;

      const result = await this.visionModel.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: imageData
                }
              }
            ]
          }
        ]
      });

      const response = result.response.candidates[0].content.parts[0].text;
      return this.parseTicketAnalysis(response);
    } catch (error) {
      console.error('❌ Ticket analysis failed:', error);
      throw error;
    }
  }

  /**
   * Process ID document for verification
   */
  async processIDDocument(imageData: string): Promise<{
    documentType: string;
    personalInfo: {
      firstName: string;
      lastName: string;
      dateOfBirth: string;
      documentNumber: string;
    };
    isValid: boolean;
    confidence: number;
  }> {
    try {
      const result = await this.extractDocumentInfo(imageData, 'id');
      
      return {
        documentType: result.documentType,
        personalInfo: result.extractedData,
        isValid: result.validationErrors.length === 0,
        confidence: result.confidence
      };
    } catch (error) {
      console.error('❌ ID document processing failed:', error);
      throw error;
    }
  }

  /**
   * Compare face in document with selfie (for verification)
   */
  async verifyIdentity(
    documentImageData: string,
    selfieImageData: string
  ): Promise<{
    match: boolean;
    confidence: number;
    reasoning: string;
  }> {
    try {
      if (!this.visionModel) {
        await this.initialize();
      }

      const prompt = `Compare the person in these two images and determine if they are the same individual.

Image 1: ID document photo
Image 2: Selfie photo

Analyze:
1. Facial features (eyes, nose, mouth, face shape)
2. Age consistency
3. Any obvious discrepancies

Provide:
- Match determination (yes/no)
- Confidence level (0-1)
- Reasoning for your decision

Format as JSON:
{
  "match": boolean,
  "confidence": 0.0-1.0,
  "reasoning": "explanation"
}`;

      const result = await this.visionModel.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: documentImageData
                }
              },
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: selfieImageData
                }
              }
            ]
          }
        ]
      });

      const response = result.response.candidates[0].content.parts[0].text;
      return this.parseVerificationResponse(response);
    } catch (error) {
      console.error('❌ Identity verification failed:', error);
      throw error;
    }
  }

  /**
   * Build extraction prompt based on document type
   */
  private buildExtractionPrompt(documentType?: string): string {
    const basePrompt = 'Analyze this travel document image and extract all relevant information.';

    const typeSpecificPrompts: { [key: string]: string } = {
      passport: `
Extract passport information:
- Passport number
- First name and last name
- Nationality
- Date of birth
- Expiry date
- Issuing country
- Gender (if visible)

Format as JSON with these exact fields.`,
      
      boarding_pass: `
Extract boarding pass information:
- Passenger name
- Flight number
- Airline
- Origin airport code
- Destination airport code
- Departure date
- Departure time
- Seat number
- Gate (if visible)
- Boarding time (if visible)
- Confirmation/booking code

Format as JSON with these exact fields.`,
      
      id: `
Extract ID document information:
- Document type (driver's license, national ID, etc.)
- First name and last name
- Date of birth
- Document number
- Expiry date (if visible)
- Issuing authority (if visible)

Format as JSON with these exact fields.`,
      
      visa: `
Extract visa information:
- Visa type
- Visa number
- Passport number
- Full name
- Nationality
- Valid from date
- Valid until date
- Issuing country

Format as JSON with these exact fields.`
    };

    const specificPrompt = documentType ? typeSpecificPrompts[documentType] : '';

    return `${basePrompt}\n\n${specificPrompt}\n\nAlso indicate your confidence level (0-1) and any validation concerns.`;
  }

  /**
   * Parse extraction response from AI
   */
  private parseExtractionResponse(
    response: string,
    documentType?: string
  ): DocumentExtractionResult {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        documentType: documentType || parsed.documentType || 'unknown',
        extractedData: parsed,
        confidence: parsed.confidence || 0.8,
        validationErrors: parsed.validationErrors || [],
        warnings: parsed.warnings || []
      };
    } catch (error) {
      console.error('Failed to parse extraction response:', error);
      return {
        documentType: 'unknown',
        extractedData: {},
        confidence: 0,
        validationErrors: ['Failed to parse document'],
        warnings: []
      };
    }
  }

  /**
   * Parse ticket analysis response
   */
  private parseTicketAnalysis(response: string): {
    flightDetails: any;
    recommendations: string[];
    warnings: string[];
  } {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          flightDetails: parsed.flightDetails || {},
          recommendations: parsed.recommendations || [],
          warnings: parsed.warnings || []
        };
      }
    } catch (error) {
      console.error('Failed to parse ticket analysis:', error);
    }

    return {
      flightDetails: {},
      recommendations: ['Unable to fully analyze ticket'],
      warnings: []
    };
  }

  /**
   * Parse verification response
   */
  private parseVerificationResponse(response: string): {
    match: boolean;
    confidence: number;
    reasoning: string;
  } {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          match: parsed.match || false,
          confidence: parsed.confidence || 0.5,
          reasoning: parsed.reasoning || 'Unable to determine match'
        };
      }
    } catch (error) {
      console.error('Failed to parse verification response:', error);
    }

    return {
      match: false,
      confidence: 0,
      reasoning: 'Verification failed'
    };
  }
}

// Export singleton instance
export const multimodalService = new MultimodalService();
