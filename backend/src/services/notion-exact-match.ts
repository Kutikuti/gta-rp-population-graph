export const normalizeExactCaseInsensitive = (value: string) => value.toLowerCase();

export const escapeLikeLiteral = (value: string) => value.replace(/[\\%_]/gu, "\\$&");
