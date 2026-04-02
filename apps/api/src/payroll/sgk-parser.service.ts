import { BadRequestException, Injectable } from '@nestjs/common';
import pdf from 'pdf-parse';

type ParsedSgkDocument = {
  identityNumber: string;
  fullName: string;
  startDate?: Date;
  exitDate?: Date;
  rawText: string;
};

@Injectable()
export class SgkParserService {
  async parseEntryPdf(buffer: Buffer) {
    const parsed = await this.parsePdf(buffer);
    return {
      ...parsed,
      startDate: this.extractRequiredDate(parsed.rawText, [
        /İşe\s+Başlad[ıi][ğg]?[ıi]?\s+Tarihi\s*[:\-]?\s*([0-9]{2}[./-][0-9]{2}[./-][0-9]{4})/i,
        /İşe\s+Giriş\s+Tarihi\s*[:\-]?\s*([0-9]{2}[./-][0-9]{2}[./-][0-9]{4})/i
      ])
    };
  }

  async parseExitPdf(buffer: Buffer) {
    const parsed = await this.parsePdf(buffer);
    return {
      ...parsed,
      exitDate: this.extractRequiredDate(parsed.rawText, [
        /İşten\s+Ayr[ıi]l[ıi]ş\s+Tarihi\s*[:\-]?\s*([0-9]{2}[./-][0-9]{2}[./-][0-9]{4})/i
      ])
    };
  }

  validateEmployeeMatch(
    employee: { firstName: string; lastName: string; identityNumber: string | null },
    parsed: ParsedSgkDocument
  ) {
    const expectedIdentity = this.normalizeIdentity(employee.identityNumber);
    if (!expectedIdentity) {
      throw new BadRequestException('SGK belgesi doğrulamak için çalışanın kimlik numarası kayıtlı olmalıdır');
    }
    if (parsed.identityNumber !== expectedIdentity) {
      throw new BadRequestException('Belgedeki kimlik numarası çalışan kaydıyla eşleşmiyor');
    }

    const expectedTokens = this.tokenizeName(`${employee.firstName} ${employee.lastName}`);
    const parsedTokens = this.tokenizeName(parsed.fullName);
    const matchedTokens = expectedTokens.filter((token) => parsedTokens.includes(token));

    if (expectedTokens.length === 0 || matchedTokens.length / expectedTokens.length < 1) {
      throw new BadRequestException('Belgedeki ad soyad çalışan kaydıyla eşleşmiyor');
    }
  }

  private async parsePdf(buffer: Buffer): Promise<ParsedSgkDocument> {
    try {
      const result = await pdf(buffer);
      const rawText = result.text?.replace(/\u00A0/g, ' ').replace(/\s+\n/g, '\n').trim();
      if (!rawText) {
        throw new BadRequestException('PDF içinden metin okunamadı');
      }
      return {
        identityNumber: this.extractRequiredIdentity(rawText),
        fullName: this.extractRequiredName(rawText),
        rawText
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('SGK PDF belgesi okunamadı');
    }
  }

  private extractRequiredIdentity(text: string) {
    const match = text.match(/(?:T\.?\s*C\.?\s*)?Kimlik\s*No\s*[:\-]?\s*([0-9\s]{11,})/i);
    const normalized = this.normalizeIdentity(match?.[1] ?? null);
    if (!normalized || normalized.length !== 11) {
      throw new BadRequestException('Belgeden geçerli kimlik numarası okunamadı');
    }
    return normalized;
  }

  private extractRequiredName(text: string) {
    const patterns = [
      /Sigortal[ıi]n[ıi]n\s+Ad[ıi]\s+Soyad[ıi]\s*[:\-]?\s*([^\n\r]+)/i,
      /Ad[ıi]\s+Soyad[ıi]\s*[:\-]?\s*([^\n\r]+)/i
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      const fullName = match?.[1]?.trim();
      if (fullName) return fullName.replace(/\s{2,}/g, ' ');
    }
    throw new BadRequestException('Belgeden ad soyad okunamadı');
  }

  private extractRequiredDate(text: string, patterns: RegExp[]) {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      const value = match?.[1];
      if (!value) continue;
      const parsed = this.parseTrDate(value);
      if (parsed) return parsed;
    }
    throw new BadRequestException('Belgeden tarih okunamadı');
  }

  private parseTrDate(value: string) {
    const normalized = value.replace(/[.]/g, '/').replace(/-/g, '/');
    const [day, month, year] = normalized.split('/');
    const date = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) return null;
    return date;
  }

  private normalizeIdentity(value: string | null) {
    return (value ?? '').replace(/\D/g, '');
  }

  private tokenizeName(value: string) {
    return this.normalizeName(value)
      .split(' ')
      .map((token) => token.trim())
      .filter((token) => token.length > 1);
  }

  private normalizeName(value: string) {
    return value
      .toLocaleLowerCase('tr')
      .replace(/ç/g, 'c')
      .replace(/ğ/g, 'g')
      .replace(/ı/g, 'i')
      .replace(/ö/g, 'o')
      .replace(/ş/g, 's')
      .replace(/ü/g, 'u')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
