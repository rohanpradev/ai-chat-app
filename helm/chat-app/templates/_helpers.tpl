{{- define "chat-app.name" -}}
chat-app
{{- end -}}

{{- define "chat-app.labels" -}}
app.kubernetes.io/name: chat-app
app.kubernetes.io/part-of: chat-app
{{- end -}}
