import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  console.log("API ROUTE HIT — MODEL = Groq")
  
  try {
    const { messages } = await request.json()

    // Fetch the API Key from environment variables
    const apiKey = process.env.GROQ_API_KEY

    if (!apiKey) {
      console.error("API Key not found in environment variables")
      console.error("Available env vars:", Object.keys(process.env).filter(k => k.includes('GROQ')))
      return NextResponse.json(
        { 
          error: "GROQ_API_KEY is not configured. Please create a .env.local file in the frontend directory with: GROQ_API_KEY=your_api_key_here" 
        },
        { status: 500 }
      )
    }

    // Convert frontend messages to Groq's format (OpenAI-compatible)
    // Groq expects: system, user, assistant roles
    const groqMessages = messages.map((msg: { role: string; content: string }) => ({
      role: msg.role === "assistant" ? "assistant" : msg.role === "user" ? "user" : "system",
      content: msg.content,
    }))

    console.log("Calling Groq API with", groqMessages.length, "messages")

    // Use Groq's OpenAI-compatible API endpoint
    // Using llama-3.3-70b-versatile model (fast and capable)
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: groqMessages,
          temperature: 0.7,
          max_tokens: 1024,
        }),
      }
    )

    console.log("Groq API response status:", response.status)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error("Groq API error details:", errorData)
      
      // Check for API key errors specifically
      const errorMessage = errorData.error?.message || errorData.error || response.statusText
      if (errorMessage.includes("API key") || errorMessage.includes("API Key") || errorMessage.includes("authentication") || response.status === 401) {
        return NextResponse.json(
          { error: "Invalid or missing API key. Please check your GROQ_API_KEY in .env.local file." },
          { status: 401 }
        )
      }
      
      return NextResponse.json(
        { error: errorMessage || `Groq API error: ${response.statusText}` },
        { status: response.status }
      )
    }

    const data = await response.json()

    // Groq returns OpenAI-compatible format: data.choices[0].message.content
    const text = data.choices?.[0]?.message?.content

    if (text) {
      console.log("Groq API success, response received")
      return NextResponse.json({ text })
    }

    return NextResponse.json(
      { error: "Unexpected response format from Groq API" },
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

