import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface RouteErrorProps {
  error: Error;
  title?: string;
  message?: string;
}

export function RouteError({ error, title = "Something went wrong", message }: RouteErrorProps) {
  return (
    <div className="flex items-center justify-center h-full p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{message || "An unexpected error occurred while loading this page."}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-center">
            <Button asChild variant="outline">
              <Link to="/">Go home</Link>
            </Button>
          </div>
          {process.env.NODE_ENV === "development" && (
            <details className="text-left text-sm">
              <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
                Error Details
              </summary>
              <Card className="mt-2">
                <CardContent className="p-3">
                  <pre className="whitespace-pre-wrap text-xs text-destructive">{error.message}</pre>
                </CardContent>
              </Card>
            </details>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
