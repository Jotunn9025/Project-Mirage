import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/auth-context";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Project Mirage",
  description: "Chat with AI - Powered by LLM",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const setTheme = () => {
                  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                };
                setTheme();
                window
                  .matchMedia('(prefers-color-scheme: dark)')
                  .addEventListener('change', setTheme);
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${manrope.className} antialiased bg-background text-foreground`}
      >
        <AuthProvider>
          <main className="min-h-screen bg-background">{children}</main>
          <footer className="w-full border-t border-border py-6 flex flex-col items-center bg-background">
            <span className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} Project Mirage. All rights reserved.
            </span>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
