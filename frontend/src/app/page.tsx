import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Header } from "@/components/header"

export default function LandingPage() {
  return (
    <>
      <Header />
      <div className="flex min-h-screen flex-col pt-16">
        {/* Hero Section */}
        <section className="flex flex-1 items-center justify-center px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl">
              Chat with AI
              <span className="block mt-2 text-primary">Powered by LLM</span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-muted-foreground sm:text-xl">
              Experience intelligent conversations with our advanced AI chatbot.
              Ask questions, get answers, and explore the power of modern language models.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <Button size="lg" asChild>
                <Link href="/chat">Go to Chat</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </>
  )
}
