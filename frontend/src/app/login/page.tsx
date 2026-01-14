"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Header } from "@/components/header"
import { useAuth } from "@/contexts/auth-context"
import { Loader2 } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const { signInWithGoogle, signInWithEmail, loading: authLoading } = useAuth()
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setError("Please fill in all fields")
      return
    }

    try {
      setIsSigningIn(true)
      setError(null)
      await signInWithEmail(email, password)
      router.push("/chat")
    } catch (err: any) {
      let errorMessage = "Failed to sign in. Please try again."
      if (err.code === "auth/invalid-email") {
        errorMessage = "Invalid email address."
      } else if (err.code === "auth/user-not-found") {
        errorMessage = "No account found with this email. Please sign up first."
      } else if (err.code === "auth/wrong-password") {
        errorMessage = "Incorrect password."
      } else if (err.code === "auth/invalid-credential") {
        errorMessage = "Invalid email or password. Please check your credentials and try again."
      } else if (err.code === "auth/too-many-requests") {
        errorMessage = "Too many failed attempts. Please try again later."
      } else if (err.code === "auth/network-request-failed") {
        errorMessage = "Network error. Please check your connection and try again."
      } else if (err.message) {
        errorMessage = err.message
      }
      setError(errorMessage)
      setIsSigningIn(false)
    }
  }

  const handleGoogleSignIn = async () => {
    try {
      setIsSigningIn(true)
      setError(null)
      await signInWithGoogle()
      router.push("/chat")
    } catch (err: any) {
      setError(err.message || "Failed to sign in. Please try again.")
      setIsSigningIn(false)
    }
  }

  return (
    <>
      <Header />
      <div className="flex min-h-screen flex-col items-center justify-center px-4 pt-16">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-foreground">Welcome Back</h1>
            <p className="mt-2 text-muted-foreground">
              Sign in to continue to Project Mirage
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-8 shadow-sm">
            {error && (
              <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Email/Password Form */}
            <form onSubmit={handleEmailSignIn} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-foreground">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSigningIn || authLoading}
                  required
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-foreground">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSigningIn || authLoading}
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={isSigningIn || authLoading}
                className="w-full"
                size="lg"
              >
                {isSigningIn || authLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>

            {/* Google Sign In */}
            <Button
              onClick={handleGoogleSignIn}
              disabled={isSigningIn || authLoading}
              variant="outline"
              className="w-full"
              size="lg"
            >
              {isSigningIn || authLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <svg
                    className="mr-2 h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Continue with Google
                </>
              )}
            </Button>

            <div className="mt-6 text-center text-sm">
              <span className="text-muted-foreground">Don't have an account? </span>
              <Link
                href="/signup"
                className="font-medium text-primary hover:underline"
              >
                Sign up
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

