"use strict";

const byId = id => document.getElementById(id);
const form = byId("chat");
const prompt = byId("prompt");
const pdf = byId("pdf");
const messages = byId("messages");
const status = byId("status");
const error = byId("error");
const send = byId("send");
const reset = byId("reset");
const promptCount = byId("prompt-count");
const maxPromptLength = 100_000;
let chatId = "";
let busy = false;

function updatePromptCount() {
    const length = prompt.value.length;
    promptCount.textContent = `${length.toLocaleString()} / ${maxPromptLength.toLocaleString()} characters`;
    promptCount.classList.toggle("over-limit", length > maxPromptLength);
}

prompt.addEventListener("input", updatePromptCount);

async function verifyBackend() {
    const response = await fetch("/", { method: "HEAD", cache: "no-store" });
    if (!response.ok)
        throw new Error(`Could not check the app server (HTTP ${response.status}).`);
    if (response.headers.get("X-Redline-Contract") !== "agentic-v2")
        throw new Error("The running app is outdated and may use the previous analyzer. Open the updated server or restart your app, then reload this page.");
}

verifyBackend().catch(failure => {
    error.textContent = failure.message;
});

function message(role, text) {
    const item = document.createElement("article");
    item.className = role === "You" ? "user" : "assistant";
    const label = document.createElement("strong");
    label.textContent = role;
    const body = document.createElement("p");
    body.textContent = text;
    item.append(label, body);
    messages.append(item);
    return item;
}

reset.addEventListener("click", () => {
    chatId = "";
    messages.replaceChildren();
    form.reset();
    updatePromptCount();
    status.textContent = "";
    error.textContent = "";
    prompt.focus();
});

form.addEventListener("submit", async event => {
    event.preventDefault();
    if (busy) return;
    error.textContent = "";

    if (prompt.value.length > maxPromptLength) {
        error.textContent = "The prompt exceeds 100,000 characters. Shorten it before sending.";
        return;
    }

    const text = prompt.value.trim();
    const attachment = pdf.files[0];
    if (!text) {
        error.textContent = "Enter a message.";
        return;
    }
    if (attachment && (!/\.pdf$/i.test(attachment.name) || attachment.size > 20 * 1024 * 1024)) {
        error.textContent = "Choose a PDF no larger than 20 MiB.";
        return;
    }

    const data = new FormData();
    data.set("prompt", text);
    if (attachment) data.set("pdf", attachment);
    else if (chatId) data.set("chatId", chatId);

    busy = true;
    for (const control of [send, reset, prompt, pdf]) control.disabled = true;
    status.textContent = attachment
        ? "Analyzing redlines and asking the agent. This can take several minutes..."
        : "Waiting for the agent...";
    try {
        await verifyBackend();
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "X-Local-Chat": "1" },
            body: data
        });
        const result = await response.json().catch(() => null);
        if (!response.ok)
            throw new Error(result?.detail ?? `Request failed (HTTP ${response.status}).`);
        if (!result?.answer) throw new Error("The server did not return a reply.");
        if (attachment && (!result.extraction || typeof result.redlineReport !== "string" || !result.redlineReport.trim()))
            throw new Error("The server did not return the required redline report. Check the analyzer and retry.");

        chatId = result.chatId;
        if (attachment) messages.replaceChildren();
        message("You", attachment ? `${text}\n\nAttachment: ${attachment.name}` : text);
        const reply = message("StrikethroughAgent", result.answer);
        if (result.extraction) {
            const warning = document.createElement("p");
            warning.className = "warning";
            warning.textContent = "The generated redline report can miss or misclassify edits. Review the original PDF. Agent instructions may prevent it from quoting deleted text.";
            reply.append(warning);
            for (const [label, text, open] of [
                ["Agentic redline report", result.redlineReport, true],
                ["View extracted Markdown", result.extraction, false]
            ]) {
                if (!text) continue;
                const details = document.createElement("details");
                const summary = document.createElement("summary");
                const content = document.createElement("pre");
                details.open = open;
                summary.textContent = label;
                content.textContent = text;
                details.append(summary, content);
                reply.append(details);
            }
        }
        form.reset();
        updatePromptCount();
        reply.scrollIntoView({ block: "nearest", behavior: "smooth" });
    } catch (failure) {
        error.textContent = failure.message;
    } finally {
        status.textContent = "";
        busy = false;
        for (const control of [send, reset, prompt, pdf]) control.disabled = false;
        prompt.focus({ preventScroll: true });
    }
});
