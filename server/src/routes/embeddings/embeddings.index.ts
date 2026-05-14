import { createRouter } from "@/lib/create-app";
import * as handlers from "@/routes/embeddings/embeddings.handler";
import * as routes from "@/routes/embeddings/embeddings.route";

const router = createRouter()
	.openapi(routes.listDocuments, handlers.listDocuments)
	.openapi(routes.ingestText, handlers.ingestText)
	.openapi(routes.uploadDocument, handlers.uploadDocument)
	.openapi(routes.searchEmbeddings, handlers.searchEmbeddings)
	.openapi(routes.rag, handlers.rag)
	.openapi(routes.deleteDocument, handlers.deleteDocument);

export default router;
