import { describe, test, expect } from "bun:test"
import {
  validateRequired,
  validateToken,
  validateUsername,
  validateRepo,
} from "./index"

describe("validateRequired", () => {
  test("accepts non-empty string", () => {
    expect(validateRequired("hello")).toBe(true)
  })

  test("rejects empty string", () => {
    expect(validateRequired("")).toBe("Field is required")
  })

  test("rejects whitespace-only with custom field name", () => {
    expect(validateRequired("   ", "Field")).toBe("Field is required")
  })

  test("uses custom field name in error", () => {
    expect(validateRequired("", "Token")).toBe("Token is required")
  })
})

describe("validateToken", () => {
  test("accepts valid token", () => {
    expect(validateToken("ghp_abc123")).toBe(true)
  })

  test("rejects empty token", () => {
    expect(validateToken("")).toBe("Token is required")
  })
})

describe("validateUsername", () => {
  test("accepts valid username", () => {
    expect(validateUsername("iamvikshan")).toBe(true)
  })

  test("rejects empty username", () => {
    expect(validateUsername("")).toBe("Username is required")
  })
})

describe("validateRepo", () => {
  test("accepts valid repo name", () => {
    expect(validateRepo("release-cleanup")).toBe(true)
  })

  test("rejects empty repo name", () => {
    expect(validateRepo("")).toBe("Repository is required")
  })
})
