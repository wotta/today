@extends('layouts.app')

@section('title', config('app.name', 'Today'))

@php
    use Today\Core\CheckItem;
    // Initial state handed to the Alpine planner component.
    $initCheck = array_map(fn (CheckItem $i) => $i->toArray(), $day->checkItems);
@endphp

@section('body')
<div class="min-h-screen">
    {{-- Full-screen notebook page. Background runs edge to edge (under the
         Dynamic Island); content is kept clear of the bezel via safe-area
         padding. Wider screens still cap the content column at max-w-xl. --}}
    <main
        x-data="planner({ date: @js($date), checkItems: @js($initCheck), agenda: @js((object) $day->agenda), note: @js($day->note), slotNotes: @js((object) $day->slotNotes), currentHour: @js($currentHour) })"
        x-on:today:synced.window="applySync($event.detail)"
        data-swipe
        data-prev="{{ route('planner', ['date' => $prevDate]) }}"
        data-next="{{ route('planner', ['date' => $nextDate]) }}"
        style="padding-top: calc(env(safe-area-inset-top) + 1.5rem); padding-bottom: calc(env(safe-area-inset-bottom) + 2rem); padding-left: max(1.5rem, env(safe-area-inset-left)); padding-right: max(1.5rem, env(safe-area-inset-right));"
        class="relative mx-auto min-h-screen w-full max-w-xl touch-pan-y bg-[#fcfcfb] dark:bg-stone-900"
    >
        {{-- Date header --}}
        <header class="mb-7">
            {{-- Title: weekday + date, Today pinned right --}}
            <div class="flex w-full items-start justify-between gap-2">
                <div class="min-w-0">
                    <span class="block text-[13px] font-medium text-stone-500 dark:text-stone-400">{{ $weekdayName }}</span>
                    <span class="block whitespace-nowrap text-3xl font-semibold leading-tight tracking-tight text-stone-800 dark:text-stone-100">{{ $monthDay }}</span>
                </div>
                <a href="{{ route('planner', ['date' => $todayDate]) }}"
                   class="mt-1 shrink-0 rounded-full border border-stone-300 px-3 py-1 text-[12px] font-medium text-stone-500 transition-colors hover:border-stone-500 hover:text-stone-800 dark:border-stone-600 dark:text-stone-400 dark:hover:border-stone-400 dark:hover:text-stone-100 {{ $isToday ? 'invisible' : '' }}">Today</a>
            </div>

            {{-- Week selector: each day taps to navigate; active = filled pill, today = rose --}}
            <div class="mt-5 flex justify-between">
                @foreach ($weekdays as $wd)
                    <a href="{{ route('planner', ['date' => $wd['date']]) }}"
                       aria-label="Go to {{ $wd['name'] }} {{ $wd['dom'] }}"
                       class="flex flex-1 flex-col items-center gap-1.5">
                        <span class="text-[11px] font-medium uppercase tracking-wide {{ $wd['active'] ? 'text-stone-500 dark:text-stone-300' : 'text-stone-400 dark:text-stone-500' }}">{{ $wd['letter'] }}</span>
                        <span class="flex h-9 w-9 items-center justify-center rounded-full text-[14px] tabular-nums transition-colors
                            {{ $wd['active']
                                ? 'bg-stone-800 font-semibold text-white dark:bg-stone-100 dark:text-stone-900'
                                : ($wd['isToday']
                                    ? 'font-semibold text-rose-500 dark:text-rose-400'
                                    : 'text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800') }}">{{ $wd['dom'] }}</span>
                    </a>
                @endforeach
            </div>
            <div class="mt-5 border-b border-stone-200 dark:border-stone-700/70"></div>
        </header>

        {{-- Check --}}
        <section>
            <h2 class="mb-2 text-base font-semibold tracking-tight text-stone-700 dark:text-stone-200">Check</h2>
            <ul>
                <template x-for="(item, index) in sortedItems" :key="item.id">
                    <li class="group flex items-center gap-2.5 border-b border-stone-200 py-2 dark:border-stone-700/70">
                        <button type="button" @click="toggle(item.id)" :aria-pressed="item.done" aria-label="Toggle done"
                            class="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[3px] border text-[11px] leading-none transition-colors"
                            :class="item.done ? 'border-stone-700 bg-stone-700 text-white dark:border-stone-300 dark:bg-stone-300 dark:text-stone-900' : 'border-stone-400 bg-white text-transparent dark:border-stone-500 dark:bg-transparent'">
                            <span x-text="item.done ? '✓' : ''"></span>
                        </button>
                        <input :value="item.text" @input="editText(item.id, $event.target.value)"
                            class="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-stone-300 dark:placeholder:text-stone-600"
                            :class="item.done ? 'text-stone-400 line-through dark:text-stone-500' : 'text-stone-700 dark:text-stone-200'" />
                        <span x-show="item.slot != null" x-text="slotLabel(item.slot)"
                            class="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium tabular-nums text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200"></span>
                        <button type="button" aria-label="Move item up" @click="moveItem(item.id, -1)" :disabled="index === 0"
                            class="shrink-0 px-0.5 text-[13px] text-stone-300 transition-colors enabled:hover:text-stone-600 disabled:opacity-30 dark:text-stone-600 dark:enabled:hover:text-stone-300">↑</button>
                        <button type="button" aria-label="Move item down" @click="moveItem(item.id, 1)" :disabled="index === sortedItems.length - 1"
                            class="shrink-0 px-0.5 text-[13px] text-stone-300 transition-colors enabled:hover:text-stone-600 disabled:opacity-30 dark:text-stone-600 dark:enabled:hover:text-stone-300">↓</button>
                        <button type="button" aria-label="Open item details" @click="openDetails(item.id)"
                            class="shrink-0 px-1 text-[13px] text-stone-300 transition-colors hover:text-stone-600 dark:text-stone-600 dark:hover:text-stone-300">⋯</button>
                        <button type="button" aria-label="Delete item" @click="remove(item.id)"
                            class="shrink-0 px-1 text-stone-300 transition-colors hover:text-stone-600 dark:text-stone-600 dark:hover:text-stone-300">✕</button>
                    </li>
                </template>

                {{-- Add row --}}
                <li class="flex items-center gap-2.5 border-b border-stone-200 py-2 dark:border-stone-700/70">
                    <span aria-hidden class="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[3px] border border-dashed border-stone-300 text-xs leading-none text-stone-300 dark:border-stone-600 dark:text-stone-600">+</span>
                    <input x-model="draft" @keydown.enter="addItem()"
                        :placeholder="checkItems.length ? 'Add a task…' : 'Add your first task…'"
                        class="flex-1 bg-transparent text-[15px] text-stone-700 outline-none placeholder:text-stone-300 dark:text-stone-200 dark:placeholder:text-stone-600" />
                </li>
            </ul>
        </section>

        {{-- Day note --}}
        <section class="mt-8">
            <div class="mb-2 flex items-baseline justify-between gap-3">
                <h2 class="text-base font-semibold tracking-tight text-stone-700 dark:text-stone-200">Day note</h2>
                <span class="text-[11px] text-stone-300 dark:text-stone-600">Markdown</span>
            </div>
            <textarea :value="note ?? ''" @input="setNote($event.target.value)"
                rows="4"
                aria-label="Day note"
                placeholder="Add markdown notes for the day…"
                class="w-full resize-y rounded-md border border-stone-200 bg-white/60 p-3 text-[14px] leading-6 text-stone-700 outline-none placeholder:text-stone-300 focus:border-stone-400 dark:border-stone-700 dark:bg-stone-900/60 dark:text-stone-200 dark:placeholder:text-stone-600 dark:focus:border-stone-500"></textarea>
        </section>

        {{-- Agenda --}}
        <section class="mt-8">
            <h2 class="mb-2 text-base font-semibold tracking-tight text-stone-700 dark:text-stone-200">Agenda</h2>
            <ul>
                <template x-for="slot in slots" :key="slot.key">
                    <li class="flex items-stretch"
                        :class="[
                            slot.isHour ? (slot.isEvenHour ? 'border-t border-stone-300 dark:border-stone-700' : 'border-t border-stone-200/60 dark:border-stone-700/40') : 'border-t border-dashed border-stone-200/70 dark:border-stone-700/50',
                            isCurrentSlot(slot.value) ? 'bg-amber-50/70 dark:bg-amber-400/10' : ''
                        ]">
                        <span class="w-14 shrink-0 select-none border-r border-stone-300 py-1 pr-3 text-right text-[11px] tabular-nums dark:border-stone-700"
                            :class="[
                                slot.isHour ? (slot.isEvenHour ? 'text-stone-400 dark:text-stone-500' : 'text-transparent') : 'text-stone-300 dark:text-stone-600',
                                isCurrentSlot(slot.value) ? '!text-amber-600 font-semibold dark:!text-amber-400' : ''
                            ]"
                            x-text="slot.isHour ? (slot.isEvenHour ? slot.label : '') : slot.minuteLabel"></span>
                        <div class="flex min-h-[34px] min-w-0 flex-1 flex-col py-1">
                            <div class="flex items-center">
                                <input :value="agenda[slot.key] ?? ''" @input="setAgenda(slot.value, $event.target.value)"
                                    :aria-label="`Agenda at ${slot.label}`"
                                    class="w-full bg-transparent px-3 text-[15px] text-stone-700 outline-none dark:text-stone-200" />
                                <details class="group/details relative shrink-0">
                                    <summary class="cursor-pointer list-none px-2 text-[13px] text-stone-300 transition-colors hover:text-stone-600 dark:text-stone-600 dark:hover:text-stone-300"
                                        :class="hasSlotNote(slot.value) ? '!text-amber-600 dark:!text-amber-400' : ''"
                                        :aria-label="`Edit notes for ${slot.label}`">✎</summary>
                                    <div class="absolute right-0 z-10 mt-1 w-72 rounded-md border border-stone-200 bg-[#fcfcfb] p-3 shadow-lg dark:border-stone-700 dark:bg-stone-900">
                                        <label class="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500" x-text="`Notes for ${slot.label}`"></label>
                                        <textarea :value="slotNotes[slot.key] ?? ''" @input="setSlotNote(slot.value, $event.target.value)"
                                            rows="5"
                                            placeholder="Markdown note…"
                                            class="w-full resize-y rounded border border-stone-200 bg-white/70 p-2 text-[13px] leading-5 text-stone-700 outline-none placeholder:text-stone-300 focus:border-stone-400 dark:border-stone-700 dark:bg-stone-950/60 dark:text-stone-200 dark:placeholder:text-stone-600 dark:focus:border-stone-500"></textarea>
                                    </div>
                                </details>
                            </div>
                            <div class="flex flex-wrap gap-1 px-3 pt-1" x-show="pinnedItems(slot.value).length">
                                <template x-for="item in pinnedItems(slot.value)" :key="item.id">
                                    <span class="inline-flex max-w-full items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 py-0.5 pl-1.5 pr-1 text-[12px] dark:border-amber-400/20 dark:bg-amber-400/10"
                                        :class="item.done ? 'opacity-60' : ''">
                                        <button type="button" @click="toggle(item.id)" class="shrink-0 text-amber-700 dark:text-amber-200" :aria-label="`Toggle ${item.text}`" x-text="item.done ? '☑' : '☐'"></button>
                                        <button type="button" @click="openDetails(item.id)" class="min-w-0 truncate text-amber-800 dark:text-amber-200" :class="item.done ? 'line-through' : ''" x-text="item.text"></button>
                                        <button type="button" @click="unpin(item.id)" class="shrink-0 px-1 text-amber-500/70 hover:text-amber-700 dark:text-amber-300/60 dark:hover:text-amber-200" :aria-label="`Unpin ${item.text}`">✕</button>
                                    </span>
                                </template>
                            </div>
                        </div>
                    </li>
                </template>
                <li class="border-t border-stone-300 dark:border-stone-700" aria-hidden></li>
            </ul>
        </section>

        {{-- Todo detail sheet --}}
        <div x-cloak x-show="openItem" x-transition.opacity
            class="fixed inset-0 z-40 flex items-end bg-stone-950/30 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
            @click.self="closeDetails()"
            @keydown.escape.window="closeDetails()">
            <section x-show="openItem" x-transition
                class="w-full rounded-t-2xl border border-stone-200 bg-[#fcfcfb] p-4 shadow-2xl dark:border-stone-700 dark:bg-stone-900">
                <div class="mb-3 flex items-start justify-between gap-3">
                    <div class="min-w-0">
                        <h2 class="truncate text-base font-semibold text-stone-800 dark:text-stone-100" x-text="openItem?.text"></h2>
                        <p class="text-[12px] text-stone-400 dark:text-stone-500">Todo details</p>
                    </div>
                    <button type="button" @click="closeDetails()" class="rounded-full px-2 py-1 text-stone-400 hover:text-stone-700 dark:text-stone-500 dark:hover:text-stone-200">Close</button>
                </div>
                <label class="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">Description markdown</label>
                <textarea :value="openItem?.description ?? ''" @input="editDescription(openItem.id, $event.target.value)"
                    rows="7"
                    placeholder="Add lightweight markdown details…"
                    class="mb-4 w-full resize-y rounded-md border border-stone-200 bg-white/70 p-3 text-[14px] leading-6 text-stone-700 outline-none placeholder:text-stone-300 focus:border-stone-400 dark:border-stone-700 dark:bg-stone-950/60 dark:text-stone-200 dark:placeholder:text-stone-600 dark:focus:border-stone-500"></textarea>
                <div class="grid gap-2">
                    <label class="text-[11px] font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">Agenda pin</label>
                    <div class="flex gap-2">
                        <select :value="openItem?.slot ?? ''" @change="$event.target.value === '' ? unpin(openItem.id) : pinToSlot(openItem.id, $event.target.value)"
                            class="min-w-0 flex-1 rounded-md border border-stone-200 bg-white/70 px-3 py-2 text-[14px] text-stone-700 outline-none focus:border-stone-400 dark:border-stone-700 dark:bg-stone-950/60 dark:text-stone-200 dark:focus:border-stone-500">
                            <option value="">Unpinned</option>
                            <template x-for="slot in slots" :key="`pin-${slot.key}`">
                                <option :value="slot.value" x-text="slot.label"></option>
                            </template>
                        </select>
                        <button type="button" @click="unpin(openItem.id)"
                            class="rounded-md border border-stone-200 px-3 py-2 text-[13px] text-stone-500 dark:border-stone-700 dark:text-stone-400">Unpin</button>
                    </div>
                </div>
            </section>
        </div>
    </main>
</div>
{{-- Bottom navigation + theme control live natively now (NativePHP EDGE bottom
     nav in the layout; theme picker on the Settings screen). --}}
@endsection
