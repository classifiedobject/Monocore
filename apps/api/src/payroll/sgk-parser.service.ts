import { BadRequestException, Injectable } from '@nestjs/common';
import pdf from 'pdf-parse/lib/pdf-parse.js';

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
      startDate: this.extractRequiredDate(
        parsed.rawText,
        [
          /İşe\s+Başlad[ıi][ğg]?[ıi]?\s+Tarihi\s*[:\-]?\s*([0-9]{2}[./-][0-9]{2}[./-][0-9]{4})/i,
          /İşe\s+Giriş\s+Tarihi\s*[:\-]?\s*([0-9]{2}[./-][0-9]{2}[./-][0-9]{4})/i
        ],
        [
          /sigortalinin\s+ise\s+basladigi\s+tarih/i,
          /ise\s+giris\s+tarih/i
        ]
      )
    };
  }

  async parseExitPdf(buffer: Buffer) {
    const parsed = await this.parsePdf(buffer);
    return {
      ...parsed,
      exitDate: this.extractRequiredDate(
        parsed.rawText,
        [
          /İşten\s+Ayr[ıi]l[ıi]ş\s+Tarihi\s*[:\-]?\s*([0-9]{2}[./-][0-9]{2}[./-][0-9]{4})/i
        ],
        [
          /isten\s+ayrilis\s+tarih/i
        ]
      )
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
      const identityNumber = this.extractRequiredIdentity(rawText);
      return {
        identityNumber,
        fullName: this.extractRequiredName(rawText, identityNumber),
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
    if (normalized && normalized.length === 11) {
      return normalized;
    }

    const candidates = [...text.matchAll(/(?<!\d)(\d{11})(?!\d)/g)]
      .map((item) => item[1])
      .filter((candidate, index, arr) => arr.indexOf(candidate) === index);
    const validIdentity = candidates.find((candidate) => this.isValidTurkishIdentity(candidate));
    if (validIdentity) {
      return validIdentity;
    }

    if (candidates.length === 1) {
      return candidates[0];
    }

    throw new BadRequestException('Belgeden geçerli kimlik numarası okunamadı');
  }

  private extractRequiredName(text: string, identityNumber?: string) {
    const patterns = [
      /Sigortal[ıi]n[ıi]n[ \t]+Ad[ıi][ \t]+Soyad[ıi]\s*[:\-]?\s*([^\n\r]+)/i,
      /Ad[ıi][ \t]+Soyad[ıi]\s*[:\-]?\s*([^\n\r]+)/i
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      const fullName = match?.[1]?.trim();
      if (fullName) return fullName.replace(/\s{2,}/g, ' ');
    }

    const lines = this.getCleanLines(text);
    const identityIndex = identityNumber
      ? lines.findIndex((line) => this.normalizeIdentity(line).includes(identityNumber))
      : -1;

    if (identityIndex >= 0) {
      const candidateLines = lines.slice(identityIndex + 1, identityIndex + 6).filter((line) => this.looksLikeNameToken(line));
      if (candidateLines.length >= 2) {
        return `${candidateLines[0]} ${candidateLines[1]}`;
      }
    }

    const allTokens = lines.filter((line) => this.looksLikeNameToken(line));
    for (let index = 0; index < allTokens.length - 1; index += 1) {
      const fullName = `${allTokens[index]} ${allTokens[index + 1]}`;
      if (fullName.length >= 5) {
        return fullName;
      }
    }

    throw new BadRequestException('Belgeden ad soyad okunamadı');
  }

  private extractRequiredDate(text: string, patterns: RegExp[], contextLabels: RegExp[] = []) {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      const value = match?.[1];
      if (!value) continue;
      const parsed = this.parseTrDate(value);
      if (parsed) return parsed;
    }

    const contextual = this.extractContextualDate(text, contextLabels);
    if (contextual) return contextual;

    throw new BadRequestException('Belgeden tarih okunamadı');
  }

  private extractContextualDate(text: string, labels: RegExp[]) {
    if (labels.length === 0) return null;
    const lines = this.getCleanLines(text);
    const labelIndex = lines.findIndex((line) => labels.some((pattern) => pattern.test(this.normalizeName(line))));
    if (labelIndex === -1) return null;
    const nearbyLines = lines.slice(labelIndex, labelIndex + 80);

    for (const line of nearbyLines) {
      const normalized = this.normalizeName(line);
      if (normalized.includes('tarihinden once hizmeti varsa')) continue;
      const matches = [...line.matchAll(/([0-9]{2}[./-][0-9]{2}[./-][0-9]{4}|[0-9]{4}[./-][0-9]{2}[./-][0-9]{2})/g)];
      for (const match of matches) {
        const parsed = this.parseTrDate(match[1]);
        if (parsed) return parsed;
      }
    }

    return null;
  }

  private parseTrDate(value: string) {
    const normalized = value.replace(/[.]/g, '/').replace(/-/g, '/');
    const parts = normalized.split('/');
    if (parts.length !== 3) return null;
    const [first, second, third] = parts;
    const [day, month, year] = first.length === 4 ? [third, second, first] : [first, second, third];
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

  private getCleanLines(value: string) {
    return value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  private looksLikeNameToken(value: string) {
    const normalized = value.trim();
    if (!normalized) return false;
    if (normalized.length < 2 || normalized.length > 40) return false;
    if (/\d/.test(normalized)) return false;
    const cleaned = normalized
      .replace(/[ÇĞİIÖŞÜ]/g, 'A')
      .replace(/[çğıöşü]/g, 'a')
      .replace(/[^A-Za-z\s]/g, '');
    return cleaned.length >= 2 && cleaned === cleaned.toUpperCase();
  }

  private isValidTurkishIdentity(value: string) {
    if (!/^[1-9][0-9]{10}$/.test(value)) return false;
    const digits = value.split('').map(Number);
    const oddSum = digits[0] + digits[2] + digits[4] + digits[6] + digits[8];
    const evenSum = digits[1] + digits[3] + digits[5] + digits[7];
    const digit10 = ((oddSum * 7) - evenSum) % 10;
    const digit11 = (digits.slice(0, 10).reduce((sum, digit) => sum + digit, 0)) % 10;
    return digit10 === digits[9] && digit11 === digits[10];
  }
}
