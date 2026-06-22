<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Domain\Gist\GistSync;
use Illuminate\Console\Command;

class GistPullCommand extends Command
{
    protected $signature = 'gist:pull';

    protected $description = 'Pull remote changes from the configured GitHub Gist into the local store';

    public function handle(GistSync $sync): int
    {
        $result = $sync->pull();
        $count = count($result['changed']);

        $this->info($count === 0 ? 'Up to date — nothing pulled.' : "Pulled {$count} changed day(s).");

        return self::SUCCESS;
    }
}
