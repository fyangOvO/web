<script setup lang="ts">
import { useI18n } from '../composables/useI18n';
const { $t } = useI18n();
</script>

<template>
  <div class="shell max-w-3xl pb-10 pt-28 md:pt-36">
    <div class="mb-10 text-center">
      <span class="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-400">
        Privacy
      </span>
      <h1 class="mt-2 text-3xl font-bold tracking-tight md:text-4xl">{{ $t('privacy.title') }}</h1>
      <p class="mt-4 text-sm text-slate-500 dark:text-slate-400">{{ $t('privacy.lastUpdated') }}</p>
    </div>

    <div class="prose-body">
      <h2>{{ $t('privacy.section1Title') }}</h2>
      <p>{{ $t('privacy.section1Text') }}</p>

      <h2>{{ $t('privacy.section2Title') }}</h2>
      <p>{{ $t('privacy.section2Text') }}</p>

      <h2>{{ $t('privacy.section3Title') }}</h2>
      <p>{{ $t('privacy.section3Text') }}</p>

      <h2>{{ $t('privacy.section4Title') }}</h2>
      <p>{{ $t('privacy.section4Text') }}</p>

      <h2>{{ $t('privacy.section5Title') }}</h2>
      <p>{{ $t('privacy.section5Text') }}</p>

      <h2>{{ $t('privacy.section6Title') }}</h2>
      <p>{{ $t('privacy.section6Text') }}</p>

      <h2>{{ $t('privacy.section7Title') }}</h2>
      <p>{{ $t('privacy.section7Text') }}</p>
    </div>

    <div class="mt-12 text-center">
      <RouterLink to="/contact" class="btn-ghost">{{ $t('privacy.cta') }}</RouterLink>
    </div>
  </div>
</template>
