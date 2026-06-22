<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Domain\Gist\GistException;
use App\Domain\Gist\GistSync;
use Illuminate\Http\JsonResponse;

class SyncController extends Controller
{
    public function __construct(private readonly GistSync $sync) {}

    /**
     * Poll the Gist for remote changes. Cheap on the common path (304 → no
     * changes). A network/auth failure returns no changes rather than erroring —
     * the frontend just retries on its next tick.
     */
    public function pull(): JsonResponse
    {
        try {
            return response()->json($this->sync->pull());
        } catch (GistException) {
            return response()->json(['changed' => [], 'days' => []]);
        }
    }
}
