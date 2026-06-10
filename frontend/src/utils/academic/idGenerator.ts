let idCounter = 0;
let uuidCounter = 0;
const uuidTimestamp = Date.now();

export function generateId(prefix = ''): string {
  idCounter++;
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 8);
  const counterPart = idCounter.toString(36);
  return prefix ? `${prefix}_${timestamp}${randomPart}${counterPart}` : `${timestamp}${randomPart}${counterPart}`;
}

export function generateUUID(): string {
  uuidCounter++;
  const timestamp = Date.now() - uuidTimestamp;
  const timestampPart = timestamp.toString(36).padStart(6, '0');

  const randomPart1 = Math.random().toString(36).substring(2, 8);
  const randomPart2 = Math.random().toString(36).substring(2, 8);
  const randomPart3 = Math.random().toString(36).substring(2, 8);
  const randomPart4 = Math.random().toString(36).substring(2, 8);

  const counterPart = uuidCounter.toString(36).padStart(4, '0');

  const formatUuid = (part: string, length: number): string => {
    return part.padStart(length, '0').substring(0, length);
  };

  return [
    formatUuid(timestampPart + randomPart1, 8),
    formatUuid(randomPart2, 4),
    formatUuid((4).toString(16) + formatUuid(randomPart3, 3), 4),
    formatUuid((8).toString(16) + formatUuid(randomPart4, 3), 4),
    formatUuid(counterPart + timestampPart, 12),
  ].join('-');
}

export function generateShortId(length = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function generateCitationKey(authors: string[], year: number | string): string {
  if (!authors || authors.length === 0) {
    return `unknown${year}`;
  }

  const getLastName = (name: string): string => {
    if (!name) return 'unknown';
    const parts = name.trim().split(/\s+/);
    const lastName = parts[parts.length - 1];
    if (!lastName) return 'unknown';
    return lastName.toLowerCase().replace(/[^a-z-z0-9]/g, '');
  };

  const lastNames = authors.map(getLastName).filter(name => name && name !== 'unknown');

  if (lastNames.length === 0) {
    return `unknown${year}`;
  }

  if (lastNames.length === 1) {
    return `${lastNames[0]}${year}`;
  }

  if (lastNames.length === 2) {
    return `${lastNames[0]}${lastNames[1]}${year}`;
  }

  return `${lastNames[0]}EtAl${year}`;
}

export function generateNumericId(): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `${timestamp}${random}`.substring(0, 16);
}

export function generateChapterId(chapterNumber: number): string {
  return `chapter_${chapterNumber}_${generateShortId(4)}`;
}

export function generateSectionId(chapterId: string, sectionNumber: number): string {
  return `${chapterId}_section_${sectionNumber}`;
}

export function generateReferenceId(): string {
  return `ref_${Date.now()}_${generateShortId(6)}`;
}

export function generateVersionId(): string {
  return `v_${Date.now()}_${generateShortId(8)}`;
}

export function generateCommentId(): string {
  return `comment_${Date.now()}_${generateShortId(6)}`;
}

export function generateOperationId(): string {
  return `op_${Date.now()}_${generateShortId(6)}`;
}
