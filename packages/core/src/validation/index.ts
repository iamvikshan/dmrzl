export function validateRequired(
  input: string,
  fieldName = "Field",
): boolean | string {
  return input.trim().length > 0 || `${fieldName} is required`
}

export function validateToken(input: string): boolean | string {
  return validateRequired(input, "Token")
}

export function validateUsername(input: string): boolean | string {
  return validateRequired(input, "Username")
}

export function validateRepo(input: string): boolean | string {
  return validateRequired(input, "Repository")
}
