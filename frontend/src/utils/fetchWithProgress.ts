/**
 * Fetch with progress tracking using ReadableStream
 * Tracks download progress when Content-Length header is available
 */
export async function fetchWithProgress(
  url: string,
  options: RequestInit = {},
  onProgress?: (progress: number) => void
): Promise<Response> {
  const response = await fetch(url, options);
  
  if (!response.ok) {
    return response;
  }

  const contentLength = response.headers.get('content-length');
  const total = contentLength ? parseInt(contentLength, 10) : null;

  // If we can't determine total size, call progress callback with null/indeterminate
  if (!total || !onProgress) {
    return response;
  }

  // If response body is already consumed or not available, return as-is
  if (!response.body) {
    return response;
  }

  // Create a new response with a progress-tracking stream
  const reader = response.body.getReader();
  const stream = new ReadableStream({
    async start(controller) {
      let loaded = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            controller.close();
            onProgress(100);
            break;
          }

          loaded += value.length;
          const progress = Math.min(100, Math.round((loaded / total) * 100));
          onProgress(progress);
          
          controller.enqueue(value);
        }
      } catch (error) {
        controller.error(error);
        throw error;
      }
    },
  });

  // Create a new Response with the progress-tracking stream
  return new Response(stream, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}






