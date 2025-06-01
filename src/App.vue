<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <div class="app-container">
    <header class="header">
      <h1 class="title">Nightreign Queue</h1>
    </header>

    <main class="main-content">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.app-container {
  min-height: 100vh;
  background:
    radial-gradient(circle at 20% 80%, rgba(212, 175, 55, 0.03) 0%, transparent 50%),
    radial-gradient(circle at 80% 20%, rgba(139, 69, 19, 0.05) 0%, transparent 50%),
    linear-gradient(180deg, #0a0a0a 0%, #1a1a1a 100%);
  color: #d4af37;
}

.header {
  padding: 1.5rem 0;
  text-align: center;
  border-bottom: 1px solid rgba(212, 175, 55, 0.2);
  background: rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(10px);
}

.title {
  font-size: 2rem;
  font-weight: 600;
  letter-spacing: 1px;
  color: #d4af37;
  margin: 0;
}

.main-content {
  flex: 1;
  padding: 2rem;
}
</style>
