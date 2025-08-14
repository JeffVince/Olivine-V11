<template>
  <div class="splash">
    <h1>Olivine</h1>
    <p>Knowledge management for creative production.</p>
    <ul>
      <li>Connect files across cloud providers</li>
      <li>Track production assets and history</li>
      <li>Collaborate with your team</li>
    </ul>
    <router-link to="/register" class="btn">Get Started</router-link>
    <router-link to="/login" class="btn">Sign In</router-link>
  </div>
</template>

<script setup lang="ts">
// simple landing page
</script>

<style scoped>
.splash {
  max-width: 600px;
  margin: 2rem auto;
  text-align: center;
}
.btn {
  display: inline-block;
  margin: 0.5rem;
  padding: 0.5rem 1rem;
  border: 1px solid #ccc;
  border-radius: 4px;
}
</style>
