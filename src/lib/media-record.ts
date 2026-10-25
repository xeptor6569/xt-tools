/** Browser capture helpers. Nothing here runs until a tool calls it from a button. */

export function userCaptureAvailable(): boolean {
  if (typeof navigator === 'undefined') return false;
  return typeof MediaRecorder !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function';
}

export function displayCaptureAvailable(): boolean {
  if (typeof navigator === 'undefined') return false;
  return typeof MediaRecorder !== 'undefined' && typeof navigator.mediaDevices?.getDisplayMedia === 'function';
}

export async function openCameraStream(): Promise<MediaStream> {
  const devices = navigator.mediaDevices;
  if (!devices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    throw new Error('Camera recording is not available in this browser.');
  }
  try {
    return await devices.getUserMedia({ video: true, audio: true });
  } catch (error) {
    if (
      error instanceof DOMException &&
      (error.name === 'NotSupportedError' || error.name === 'OverconstrainedError')
    ) {
      return await devices.getUserMedia({ video: true });
    }
    throw error;
  }
}

export async function openMicrophoneStream(): Promise<MediaStream> {
  const devices = navigator.mediaDevices;
  if (!devices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    throw new Error('Microphone recording is not available in this browser.');
  }
  return devices.getUserMedia({ audio: true });
}

export async function openDisplayStream(): Promise<MediaStream> {
  const devices = navigator.mediaDevices;
  if (!devices?.getDisplayMedia || typeof MediaRecorder === 'undefined') {
    throw new Error('Screen recording is not available in this browser.');
  }
  try {
    return await devices.getDisplayMedia({ video: true, audio: true });
  } catch (error) {
    if (
      error instanceof DOMException &&
      (error.name === 'NotSupportedError' || error.name === 'OverconstrainedError')
    ) {
      return await devices.getDisplayMedia({ video: true });
    }
    throw error;
  }
}

export async function openQrCameraStream(): Promise<MediaStream> {
  const devices = navigator.mediaDevices;
  if (!devices?.getUserMedia) throw new Error('The camera is not available in this browser.');
  try {
    return await devices.getUserMedia({ video: { facingMode: 'environment' } });
  } catch (error) {
    if (
      error instanceof DOMException &&
      (error.name === 'NotSupportedError' || error.name === 'OverconstrainedError')
    ) {
      return await devices.getUserMedia({ video: true });
    }
    throw error;
  }
}

export function beginRecording(stream: MediaStream, mime: string): { stop: () => void; finished: Promise<Blob> } {
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, { mimeType: mime });
  } catch {
    recorder = new MediaRecorder(stream);
  }
  const chunks: Blob[] = [];
  const finished = new Promise<Blob>((resolve) => {
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = () => {
      const type = recorder.mimeType || mime || 'application/octet-stream';
      resolve(new Blob(chunks, { type }));
    };
  });
  recorder.start(250);
  return {
    stop: () => {
      if (recorder.state !== 'inactive') recorder.stop();
    },
    finished,
  };
}

export function stopTracks(stream: MediaStream | undefined): void {
  stream?.getTracks().forEach((track) => track.stop());
}

/** Stops the recorder first so the last chunk is kept, then releases the device. */
export function recordUntilStopped(
  stream: MediaStream,
  mime: string,
  releasePreview: () => void,
): { stop: () => void; done: Promise<Blob> } {
  const recording = beginRecording(stream, mime);
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    releasePreview();
    recording.stop();
  };
  const done = recording.finished.then((blob) => {
    stopTracks(stream);
    return blob;
  });
  return { stop, done };
}

/** Draws a stream onto a canvas. The video element stays off the page so it is not announced as media. */
export function previewStream(stream: MediaStream, canvas: HTMLCanvasElement | null): () => void {
  if (!canvas) return () => {};
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  void video.play().catch(() => {});
  let frame = 0;
  const draw = () => {
    if (video.readyState >= 2 && video.videoWidth > 0) {
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    }
    frame = requestAnimationFrame(draw);
  };
  frame = requestAnimationFrame(draw);
  return () => {
    cancelAnimationFrame(frame);
    video.pause();
    video.srcObject = null;
  };
}
