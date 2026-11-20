# PDF Review Chat

A local .NET 10 web app for chatting with the existing Microsoft Foundry `StrikethroughAgent`. The web app runs locally; Content Understanding and the agent run in Azure.

## Run locally

Install the [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0) and [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli). Sign in with an account that can analyze documents in Content Understanding and invoke the agent in the `multimodalsearch` Foundry project.

```powershell
az login
dotnet run
```

Open [http://localhost:5037](http://localhost:5037), attach a bill PDF, and ask a question such as **“Summarize the bill using only the text that remains in effect.”** The agentic redline report appears below the answer; expand **View extracted Markdown** to inspect the extracted text. Send follow-up questions without reattaching the PDF. A new attachment starts a new conversation.

The prompt editor can be resized and accepts up to 100,000 characters. The agent's model may impose a smaller combined context limit for the prompt, extracted PDF, and conversation history.

After updating the app, restart your running app or start the updated app on another unused port. The browser reports an outdated server rather than using the previous analyzer.

## How it works

- The ASP.NET Core backend sends the original PDF to Content Understanding agentic analyzer `billRedlinesAgenticModel_780676a4` using the `2026-06-01-preview` API. The PDF bytes are base64-encoded for transport, not converted to images. No public file URL or blob storage is needed.
- The analyzer definition is in `agentic-redlines.json`. Each analysis request maps its `prebuilt-analyzer-completion` alias to the existing `gpt-6.1-sol` deployment; the app does not change resource-wide model defaults. Calling this analyzer without that override uses the resource's default model instead.
- The backend sends the prompt, extracted Markdown, any available annotation metadata, and generated redline report to the existing agent using Microsoft Agent Framework. The agent's model, tools, and instructions stay configured in Foundry.
- The current agent instructions prohibit quoting or discussing deleted wording in its answer. The redline report still shows detected deletions.
- PDF files are limited to 20 MiB, and extracted text plus the redline report to 100,000 characters. Split documents that exceed either limit. The preview analyzer can miss or misclassify edits, including underlines; verify its report against the original PDF.
- Agentic analysis can take several minutes and incurs Content Understanding and model usage charges. The GPT-6.1 model used more tokens and took longer than the previous model in the sample comparison.
- The browser and app run locally, but the file is sent to Azure and the extracted text is sent to Foundry. Local chat handles expire after 30 minutes idle or on server restart. **New chat** does not delete data already sent to Azure.

The endpoints, agent name, analyzer ID, and model deployment are in `appsettings.json`. `ContentUnderstanding:Agentic` is used by the current app; the older `ContentUnderstanding:AnalyzerId` is retained for existing older processes. Optionally set `Foundry__AgentVersion` to pin an agent version. The app uses your Azure CLI sign-in. If Content Understanding requires an API key, set `ContentUnderstanding__ApiKey` in the server process environment; do not put the key in source. Foundry still uses Azure CLI sign-in.
