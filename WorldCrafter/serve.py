"""Local static preview with byte ranges for MP4 seeking. No dependencies."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os
from pathlib import Path
import re


class VideoHandler(SimpleHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def end_headers(self):
        self.send_header('Accept-Ranges', 'bytes')
        super().end_headers()

    def send_head(self):
        self.bytes_remaining = None
        header = self.headers.get('Range')
        path = self.translate_path(self.path)
        if not header or not os.path.isfile(path):
            return super().send_head()
        stream = open(path, 'rb')
        stat = os.fstat(stream.fileno())
        size = stat.st_size
        match = re.fullmatch(r'bytes=(\d*)-(\d*)', header.strip())
        if not match or not any(match.groups()) or not size:
            stream.close()
            self.send_error(416, 'Unsupported byte range')
            return None
        if match[1]:
            start = int(match[1])
            end = min(int(match[2]), size-1) if match[2] else size-1
        else:
            start = max(0, size-int(match[2]))
            end = size-1
        if start >= size or end < start:
            stream.close()
            self.send_response(416)
            self.send_header('Content-Range', f'bytes */{size}')
            self.send_header('Content-Length', '0')
            self.end_headers()
            return None
        self.send_response(206)
        self.send_header('Content-Type', self.guess_type(path))
        self.send_header('Content-Length', str(end-start+1))
        self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.send_header('Last-Modified', self.date_time_string(stat.st_mtime))
        self.end_headers()
        stream.seek(start)
        self.bytes_remaining = end-start+1
        return stream

    def copyfile(self, source, outputfile):
        try:
            if self.bytes_remaining is None:
                return super().copyfile(source, outputfile)
            while self.bytes_remaining:
                block = source.read(min(256*1024, self.bytes_remaining))
                if not block:
                    break
                outputfile.write(block)
                self.bytes_remaining -= len(block)
        except (BrokenPipeError, ConnectionResetError):
            pass  # A scene switch cancels the previous video's request.

    def log_message(self, fmt, *args):
        if len(args) > 1 and str(args[1]).startswith(('4', '5')):
            super().log_message(fmt, *args)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=4173)
    args = parser.parse_args()
    handler = partial(VideoHandler, directory=str(Path(__file__).resolve().parent))
    server = ThreadingHTTPServer(('127.0.0.1', args.port), handler)
    print(f'WorldCrafter preview: http://127.0.0.1:{args.port}/', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
