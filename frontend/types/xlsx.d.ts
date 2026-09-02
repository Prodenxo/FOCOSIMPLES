declare module 'xlsx' {
  export const utils: {
    json_to_sheet: (data: Record<string, unknown>[]) => Record<string, unknown>
    book_new: () => Record<string, unknown>
    book_append_sheet: (
      workbook: Record<string, unknown>,
      worksheet: Record<string, unknown>,
      name: string,
    ) => void
  }
  export function writeFile(workbook: Record<string, unknown>, filename: string): void
  export function write(
    workbook: Record<string, unknown>,
    opts: { type: string; bookType: string },
  ): string
}
