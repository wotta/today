<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Domain\Upload\S3UploadService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;
use Throwable;

class UploadController extends Controller
{
    public function __construct(private readonly S3UploadService $uploads) {}

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'file' => ['required', 'file', 'max:20480'],
        ]);

        try {
            return response()->json(['ok' => true] + $this->uploads->upload($data['file']));
        } catch (RuntimeException $e) {
            return response()->json(['ok' => false, 'message' => $e->getMessage()], 422);
        } catch (Throwable) {
            return response()->json([
                'ok' => false,
                'message' => 'Upload failed. Check the bucket, endpoint, and credentials.',
            ], 502);
        }
    }
}
