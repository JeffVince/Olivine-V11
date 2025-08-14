<template>
  <div>
    <h2>Call Sheet Composer</h2>
    <CallSheetPreview 
      :call-sheet="callSheet" 
      :loading="loading"
      @save-draft="saveDraft"
      @publish="publishFinal"
    />
  </div>
</template>

<script setup lang="ts">
import { useCallSheetManagement } from './Composables/useCallSheetManagement'
import CallSheetPreview from './Components/CallSheetPreview.vue'

const {
  callSheet,
  loading,
  saveDraft,
  publishFinal
} = useCallSheetManagement()
</script>


