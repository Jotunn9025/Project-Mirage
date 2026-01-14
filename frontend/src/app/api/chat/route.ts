import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  console.log("API ROUTE HIT — MODEL = gemini-3-flash-preview")
  
  try {
    const { messages } = await request.json()

    // Fetch the API Key from environment variables
    const apiKey = process.env.GEMINI_API_KEY

    if (!apiKey) {
      console.error("API Key not found in environment variables")
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured in .env file" },
        { status: 500 }
      )
    }

    // Convert frontend messages to Gemini's multi-turn format
    // Roles must alternate: "user", "model", "user", "model"
    const contents = messages.map((msg: { role: string; content: string }) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    }))

    console.log("Calling Gemini API with", contents.length, "messages")

    // Use the 2026 Gemini 3 Flash model
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: contents, // Use the actual conversation history here
        }),
      }
    )

    console.log("Gemini API response status:", response.status)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error("Gemini API error details:", errorData)
      return NextResponse.json(
        { error: errorData.error?.message || `Gemini API error: ${response.statusText}` },
        { status: response.status }
      )
    }

    const data = await response.json()

    // Robust check for the nested response structure
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (text) {
      console.log("Gemini API success, response received")
      return NextResponse.json({ text })
    }

    return NextResponse.json(
      { error: "Unexpected response format or content blocked by safety filters" },
      { status: 500 }
    )

  } catch (error: any) {
    console.error("Chat API internal error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

