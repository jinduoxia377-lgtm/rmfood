{{/*
RMFOOD Helm Chart Helpers
*/}}

{{/*
Expand the name of the chart.
*/}}
{{- define "rmfood.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "rmfood.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "rmfood.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "rmfood.labels" -}}
helm.sh/chart: {{ include "rmfood.chart" . }}
{{ include "rmfood.selectorLabels" . }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "rmfood.selectorLabels" -}}
app.kubernetes.io/name: {{ include "rmfood.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
ServiceAccount name
*/}}
{{- define "rmfood.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "rmfood.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Database connection string (for ConfigMap)
*/}}
{{- define "rmfood.databaseUrl" -}}
postgresql+asyncpg://{{ .Values.postgresql.env.POSTGRES_USER }}:$(POSTGRES_PASSWORD)@{{ include "rmfood.fullname" . }}-postgres:5432/{{ .Values.postgresql.env.POSTGRES_DB }}
{{- end }}

{{/*
Redis connection string (for ConfigMap)
*/}}
{{- define "rmfood.redisUrl" -}}
{{- if .Values.redis.password }}
redis://:$(REDIS_PASSWORD)@{{ include "rmfood.fullname" . }}-redis:6379/0
{{- else }}
redis://{{ include "rmfood.fullname" . }}-redis:6379/0
{{- end }}
{{- end }}
