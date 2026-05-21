import { defaultModelId, models as fallbackModels } from "@chat-app/shared";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Database, FileText, Loader2, Search, Sparkles, Trash2, Upload } from "lucide-react";
import type { FormEvent } from "react";
import { useMemo, useRef, useState } from "react";
import { Loader } from "@/components/ai-elements/loader";
import { MessageResponse } from "@/components/ai-elements/message";
import { Sources, SourcesContent, SourcesTrigger } from "@/components/ai-elements/sources";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  getEmbeddingDocumentsQuery,
  useDeleteEmbeddingDocument,
  useIngestEmbeddingText,
  useRagQuestion,
  useSearchEmbeddings,
  useUploadEmbeddingDocument,
} from "@/queries/embeddings";
import { getAiModelsQuery } from "@/queries/getAiModels";

export const Route = createFileRoute("/chat/embeddings")({
  component: EmbeddingsPage,
});

const acceptedDocumentTypes =
  "application/pdf,text/plain,text/markdown,application/json,text/csv,text/html,text/css,text/xml,application/xml,.md,.txt,.json,.csv,.html,.css,.xml,.js,.jsx,.ts,.tsx,.py,.java,.cpp,.c";

const numberFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 3,
  minimumFractionDigits: 3,
});

const TOP_MATCH_LIMIT = 3;

const scoreToPercent = (score: number) => Math.max(0, Math.min(100, ((score + 1) / 2) * 100));

const formatDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const formatError = (error: unknown) => (error instanceof Error ? error.message : "Request failed");

function EmbeddingOperationStatus({
  detail,
  title,
}: Readonly<{
  detail: string;
  title: string;
}>) {
  return (
    <div className="rounded-lg border bg-muted/25 p-4">
      <div className="flex items-center gap-3">
        <Loader className="shrink-0 text-primary" size={18} />
        <div className="min-w-0">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{detail}</p>
        </div>
      </div>
      <Progress className="mt-4 h-1.5" value={67} />
    </div>
  );
}

function EmbeddingsPage() {
  const uploadFormRef = useRef<HTMLFormElement | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [textTitle, setTextTitle] = useState("");
  const [textContent, setTextContent] = useState("");
  const [query, setQuery] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [model, setModel] = useState(defaultModelId);

  const documentsQuery = useQuery(getEmbeddingDocumentsQuery());
  const modelsQuery = useQuery(getAiModelsQuery());

  const uploadMutation = useUploadEmbeddingDocument();
  const ingestTextMutation = useIngestEmbeddingText();
  const deleteMutation = useDeleteEmbeddingDocument();
  const searchMutation = useSearchEmbeddings();
  const ragMutation = useRagQuestion();

  const documents = documentsQuery.data ?? [];
  const availableModels = modelsQuery.data && modelsQuery.data.length > 0 ? modelsQuery.data : fallbackModels;

  const selectedDocument = useMemo(
    () => documents.find((document) => document.id === documentId),
    [documents, documentId],
  );

  const searchPayload = useMemo(
    () => ({
      documentId: documentId || undefined,
      includeContent: true,
      limit: TOP_MATCH_LIMIT,
      minScore: 0,
      query: query.trim(),
    }),
    [documentId, query],
  );

  const resetSearchState = () => {
    searchMutation.reset();
    ragMutation.reset();
  };

  const handleUpload = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!file) {
      return;
    }

    uploadMutation.mutate(
      {
        file,
        title: uploadTitle.trim() || undefined,
      },
      {
        onSuccess: () => {
          setFile(null);
          setUploadTitle("");
          uploadFormRef.current?.reset();
          resetSearchState();
        },
      },
    );
  };

  const handleTextIngest = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const content = textContent.trim();

    if (!content) {
      return;
    }

    ingestTextMutation.mutate(
      {
        content,
        contentType: "text/markdown",
        title: textTitle.trim() || "Pasted content",
      },
      {
        onSuccess: () => {
          setTextContent("");
          setTextTitle("");
          resetSearchState();
        },
      },
    );
  };

  const handleDelete = (id: string, title: string) => {
    const shouldDelete = window.confirm(`Delete "${title}" and all of its vector chunks?`);

    if (!shouldDelete) {
      return;
    }

    deleteMutation.mutate(id, {
      onSuccess: () => {
        if (documentId === id) {
          setDocumentId("");
        }

        resetSearchState();
      },
    });
  };

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!searchPayload.query) {
      return;
    }

    searchMutation.mutate(searchPayload);
  };

  const handleRag = () => {
    if (!searchPayload.query) {
      return;
    }

    ragMutation.mutate({
      documentId: documentId || undefined,
      limit: TOP_MATCH_LIMIT,
      minScore: 0,
      model,
      query: searchPayload.query,
    });
  };

  const isVectorizing = uploadMutation.isPending || ingestTextMutation.isPending;
  const isSearching = searchMutation.isPending;
  const isAsking = ragMutation.isPending;
  const isBusy = isVectorizing || isSearching || isAsking;
  const activeOperation = uploadMutation.isPending
    ? {
        detail: file?.name ? `Extracting and embedding ${file.name}` : "Extracting and embedding the uploaded document",
        title: "Vectorizing upload",
      }
    : ingestTextMutation.isPending
      ? {
          detail: textTitle.trim()
            ? `Chunking and embedding ${textTitle.trim()}`
            : "Chunking and embedding pasted content",
          title: "Vectorizing content",
        }
      : isSearching
        ? {
            detail: "Embedding the query and ranking matching chunks",
            title: "Searching vectors",
          }
        : isAsking
          ? {
              detail: "Retrieving source chunks and generating a grounded answer",
              title: "Generating RAG answer",
            }
          : undefined;

  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 md:p-6">
        <div className="flex flex-col gap-2 border-b pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal">Embeddings</h1>
            <p className="text-sm text-muted-foreground">Documents, vectors, semantic search, and RAG answers.</p>
          </div>

          <Badge variant="outline" className="rounded-md">
            {documents.length} {documents.length === 1 ? "document" : "documents"}
          </Badge>
        </div>

        {activeOperation ? <EmbeddingOperationStatus {...activeOperation} /> : null}

        <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <section className="grid min-h-0 content-start gap-4">
            <Card className="rounded-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Upload className="size-4" />
                  Upload
                </CardTitle>
                <CardDescription>PDF or text-like source</CardDescription>
              </CardHeader>

              <CardContent>
                <form ref={uploadFormRef} className="grid gap-3" onSubmit={handleUpload}>
                  <div className="grid gap-2">
                    <Label htmlFor="embedding-file">File</Label>
                    <Input
                      accept={acceptedDocumentTypes}
                      id="embedding-file"
                      onChange={(event) => setFile(event.currentTarget.files?.[0] ?? null)}
                      type="file"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="embedding-upload-title">Title</Label>
                    <Input
                      id="embedding-upload-title"
                      onChange={(event) => setUploadTitle(event.target.value)}
                      placeholder={file?.name || "Document title"}
                      value={uploadTitle}
                    />
                  </div>

                  <Button disabled={!file || uploadMutation.isPending} type="submit">
                    {uploadMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Upload className="size-4" />
                    )}
                    Vectorize
                  </Button>

                  {uploadMutation.error ? (
                    <p className="text-sm text-destructive">{formatError(uploadMutation.error)}</p>
                  ) : null}
                </form>
              </CardContent>
            </Card>

            <Card className="rounded-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="size-4" />
                  Content
                </CardTitle>
                <CardDescription>Paste text, markdown, JSON, or notes</CardDescription>
              </CardHeader>

              <CardContent>
                <form className="grid gap-3" onSubmit={handleTextIngest}>
                  <div className="grid gap-2">
                    <Label htmlFor="embedding-text-title">Title</Label>
                    <Input
                      id="embedding-text-title"
                      onChange={(event) => setTextTitle(event.target.value)}
                      placeholder="Pasted content"
                      value={textTitle}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="embedding-text-content">Content</Label>
                    <Textarea
                      className="min-h-40 resize-y"
                      id="embedding-text-content"
                      onChange={(event) => setTextContent(event.target.value)}
                      value={textContent}
                    />
                  </div>

                  <Button disabled={!textContent.trim() || ingestTextMutation.isPending} type="submit">
                    {ingestTextMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Database className="size-4" />
                    )}
                    Vectorize
                  </Button>

                  {ingestTextMutation.error ? (
                    <p className="text-sm text-destructive">{formatError(ingestTextMutation.error)}</p>
                  ) : null}
                </form>
              </CardContent>
            </Card>

            <Card className="rounded-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Database className="size-4" />
                  Documents
                </CardTitle>
                <CardDescription>Stored vectors</CardDescription>
              </CardHeader>

              <CardContent className="grid gap-3">
                {documentsQuery.isLoading ? (
                  <EmbeddingOperationStatus detail="Loading your vectorized document index" title="Loading documents" />
                ) : null}

                {documentsQuery.error ? (
                  <p className="text-sm text-destructive">{formatError(documentsQuery.error)}</p>
                ) : null}

                {documents.length === 0 && !documentsQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">No vectorized documents yet.</p>
                ) : null}

                {documents.map((document) => (
                  <div className="rounded-lg border p-3" key={document.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{document.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {document.chunkCount} chunks · {document.embeddingDimensions} dims ·{" "}
                          {formatDate(document.createdAt)}
                        </p>
                      </div>

                      <Button
                        aria-label={`Delete ${document.title}`}
                        disabled={deleteMutation.isPending}
                        onClick={() => handleDelete(document.id, document.title)}
                        size="icon-sm"
                        type="button"
                        variant="ghost"
                      >
                        {deleteMutation.isPending ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Trash2 className="size-4" />
                        )}
                      </Button>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge className="rounded-md" variant="secondary">
                        {document.sourceType}
                      </Badge>
                      <Badge className="rounded-md" variant="outline">
                        {document.embeddingModel}
                      </Badge>
                    </div>
                  </div>
                ))}

                {deleteMutation.error ? (
                  <p className="text-sm text-destructive">{formatError(deleteMutation.error)}</p>
                ) : null}
              </CardContent>
            </Card>
          </section>

          <section className="grid min-h-0 content-start gap-4 lg:max-h-[calc(100vh-8rem)]">
            <Card className="rounded-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Search className="size-4" />
                  Embedding Search
                </CardTitle>
                <CardDescription>{selectedDocument ? selectedDocument.title : "All documents"}</CardDescription>
              </CardHeader>

              <CardContent>
                <form className="grid gap-3" onSubmit={handleSearch}>
                  <div className="grid gap-2">
                    <Label htmlFor="embedding-document-filter">Scope</Label>
                    <Select
                      onValueChange={(value) => setDocumentId(value === "all" ? "" : value)}
                      value={documentId || "all"}
                    >
                      <SelectTrigger className="w-full" id="embedding-document-filter">
                        <SelectValue placeholder="All documents" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All documents</SelectItem>
                        {documents.map((document) => (
                          <SelectItem key={document.id} value={document.id}>
                            {document.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="embedding-query">Query</Label>
                    <Textarea
                      className="min-h-28 resize-y"
                      id="embedding-query"
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Ask a question or search semantically across your vectorized documents"
                      value={query}
                    />
                  </div>

                  <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto]">
                    <Select
                      aria-label="RAG model"
                      disabled={modelsQuery.isLoading}
                      onValueChange={setModel}
                      value={model}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Model" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableModels.map((modelOption) => (
                          <SelectItem key={modelOption.id} value={modelOption.id}>
                            {modelOption.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button disabled={!query.trim() || isSearching || isVectorizing} type="submit" variant="outline">
                      {isSearching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                      Search
                    </Button>

                    <Button disabled={!query.trim() || isAsking || isVectorizing} onClick={handleRag} type="button">
                      {isAsking ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                      Ask
                    </Button>
                  </div>
                </form>

                {modelsQuery.error ? (
                  <p className="mt-3 text-sm text-destructive">{formatError(modelsQuery.error)}</p>
                ) : null}

                {searchMutation.error ? (
                  <p className="mt-3 text-sm text-destructive">{formatError(searchMutation.error)}</p>
                ) : null}

                {ragMutation.error ? (
                  <p className="mt-3 text-sm text-destructive">{formatError(ragMutation.error)}</p>
                ) : null}

                <div className="mt-3 grid gap-2">
                  {isSearching ? (
                    <EmbeddingOperationStatus
                      detail="Embedding the query and comparing stored chunks"
                      title="Searching"
                    />
                  ) : null}
                  {isAsking ? (
                    <EmbeddingOperationStatus
                      detail="Building an answer from the strongest retrieved chunks"
                      title="Asking"
                    />
                  ) : null}
                </div>
              </CardContent>
            </Card>

            {isAsking && !ragMutation.data ? (
              <Card className="min-h-0 rounded-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Sparkles className="size-4" />
                    RAG Answer
                  </CardTitle>
                  <CardDescription>{model}</CardDescription>
                </CardHeader>

                <CardContent>
                  <EmbeddingOperationStatus
                    detail="Retrieving sources and composing the answer"
                    title="Generating answer"
                  />
                </CardContent>
              </Card>
            ) : null}

            {ragMutation.data ? (
              <Card className="min-h-0 rounded-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Sparkles className="size-4" />
                    RAG Answer
                  </CardTitle>
                  <CardDescription>{ragMutation.data.model}</CardDescription>
                </CardHeader>

                <CardContent className="grid min-h-0 gap-4">
                  <div className="max-h-96 overflow-y-auto rounded-md border bg-muted/25 p-4">
                    <MessageResponse className="prose prose-sm dark:prose-invert max-w-none break-words text-sm leading-6">
                      {ragMutation.data.answer}
                    </MessageResponse>
                  </div>

                  {ragMutation.data.sources.length > 0 ? (
                    <Sources className="mb-0">
                      <SourcesTrigger count={ragMutation.data.sources.length}>
                        <span className="font-medium">Retrieved {ragMutation.data.sources.length} sources</span>
                      </SourcesTrigger>
                      <SourcesContent className="w-full">
                        <div className="grid gap-2">
                          {ragMutation.data.sources.map((source, index) => (
                            <div
                              className="flex min-w-0 items-center gap-2 rounded-md border bg-background px-3 py-2"
                              key={source.chunkId}
                            >
                              <Badge className="rounded-md" variant="secondary">
                                {index + 1}
                              </Badge>
                              <span className="min-w-0 flex-1 truncate text-sm font-medium">{source.title}</span>
                              <span className="text-xs text-muted-foreground">
                                {numberFormatter.format(source.score)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </SourcesContent>
                    </Sources>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}

            <Card className="flex min-h-0 rounded-lg lg:max-h-[calc(100vh-24rem)]">
              <div className="flex min-h-0 w-full flex-col">
                <CardHeader className="shrink-0">
                  <CardTitle className="text-base">Matches</CardTitle>
                  <CardDescription>
                    {searchMutation.data ? `Top ${searchMutation.data.results.length} matches` : "No search run"}
                  </CardDescription>
                </CardHeader>

                <CardContent className="min-h-0 flex-1 overflow-y-auto pr-2">
                  <div className="grid gap-3">
                    {isBusy && !searchMutation.data ? (
                      <EmbeddingOperationStatus
                        detail="The request is running; results will fill this panel as soon as they are ready"
                        title="Working"
                      />
                    ) : null}

                    {searchMutation.data?.results.map((result, index) => (
                      <article className="min-w-0 rounded-lg border bg-card p-3 shadow-xs" key={result.chunkId}>
                        <div className="grid gap-3">
                          <div className="flex min-w-0 items-start gap-3">
                            <Badge className="mt-0.5 rounded-md" variant="secondary">
                              {index + 1}
                            </Badge>

                            <div className="min-w-0 flex-1">
                              <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium">{result.title}</p>
                                  <p className="text-xs text-muted-foreground">Chunk {result.chunkIndex + 1}</p>
                                </div>

                                <Badge className="max-w-full truncate rounded-md" variant="outline">
                                  {result.sourceName ?? "content"}
                                </Badge>
                              </div>

                              <div className="mt-3 grid gap-1.5">
                                <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                                  <span>Similarity</span>
                                  <span>{numberFormatter.format(result.score)}</span>
                                </div>
                                <Progress className="h-1.5 bg-muted" value={scoreToPercent(result.score)} />
                              </div>
                            </div>
                          </div>

                          {result.content ? (
                            <div className="max-h-56 overflow-y-auto rounded-md bg-muted/30 p-3">
                              <MessageResponse className="prose prose-sm dark:prose-invert max-w-none break-words text-sm leading-6">
                                {result.content}
                              </MessageResponse>
                            </div>
                          ) : null}
                        </div>
                      </article>
                    ))}

                    {searchMutation.data?.results.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No matching chunks found.</p>
                    ) : null}
                  </div>
                </CardContent>
              </div>
            </Card>
          </section>
        </div>
      </div>
    </main>
  );
}
