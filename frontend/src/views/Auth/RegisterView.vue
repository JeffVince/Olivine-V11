<template>
  <div class="auth-form">
    <h2>Create Account</h2>
    <form @submit.prevent="onSubmit">
      <input v-model="orgName" placeholder="Organization Name" />
      <input v-model="email" type="email" placeholder="Email" />
      <input v-model="password" type="password" placeholder="Password" />
      <button type="submit">Register</button>
    </form>
    <router-link to="/login">Already have an account?</router-link>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '@/stores/authStore';
import { useRouter } from 'vue-router';

const orgName = ref('');
const email = ref('');
const password = ref('');
const auth = useAuthStore();
const router = useRouter();

async function onSubmit() {
  try {
    await auth.register(orgName.value, email.value, password.value);
    router.push('/projects');
  } catch (e) {
    console.error(e);
  }
}
</script>

<style scoped>
.auth-form {
  max-width: 400px;
  margin: 2rem auto;
  text-align: center;
}
input {
  display: block;
  width: 100%;
  margin: 0.5rem 0;
  padding: 0.5rem;
}
button {
  padding: 0.5rem 1rem;
}
</style>
