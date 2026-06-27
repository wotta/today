function csrfToken() {
    return document.querySelector('meta[name="csrf-token"]')?.content ?? '';
}

export function insertMarkdownLink(textarea, markdown) {
    if (!(textarea instanceof HTMLTextAreaElement)) return false;

    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? start;
    textarea.setRangeText(markdown, start, end, 'end');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.focus();

    return true;
}

export async function uploadAttachment(file) {
    const body = new FormData();
    body.append('file', file);

    const response = await fetch('/api/uploads', {
        method: 'POST',
        headers: {
            'X-CSRF-TOKEN': csrfToken(),
            Accept: 'application/json',
        },
        body,
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || payload.ok === false) {
        throw new Error(payload.message || 'Upload failed.');
    }

    return payload;
}

export async function attachFileToTextarea(file, textarea = document.activeElement) {
    const upload = await uploadAttachment(file);
    insertMarkdownLink(textarea, upload.markdown);

    return upload;
}

window.TodayUploads = {
    attachFileToTextarea,
    insertMarkdownLink,
    uploadAttachment,
};
