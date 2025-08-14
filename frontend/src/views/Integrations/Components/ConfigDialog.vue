<template>
  <v-dialog
    v-model="dialog"
    max-width="600px"
    persistent
  >
    <v-card>
      <v-card-title class="text-h6">
        Configure {{ selectedIntegration?.name || 'Integration' }}
      </v-card-title>
      
      <v-card-text>
        <!-- Root Folder Selection -->
        <v-text-field
          v-model="localRootFolder"
          label="Root Folder"
          hint="The root folder path for this integration"
          persistent-hint
          class="mb-4"
          :disabled="loading"
          @keydown.enter="save"
        />
        
        <!-- Webhook Toggle -->
        <v-switch
          v-model="localEnableWebhooks"
          label="Enable Webhooks"
          hint="Enable real-time updates via webhooks"
          persistent-hint
          :disabled="loading"
          class="mt-0"
        />
        
        <v-alert
          v-if="error"
          type="error"
          class="mt-4"
        >
          {{ error }}
        </v-alert>
      </v-card-text>
      
      <v-card-actions>
        <v-spacer />
        <v-btn
          text
          :disabled="loading"
          @click="close"
        >
          Cancel
        </v-btn>
        <v-btn
          color="primary"
          :loading="loading"
          @click="save"
        >
          Save
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
import { defineComponent, ref, watch, PropType } from 'vue';
import type { Integration } from '../Composables/Interface';

export default defineComponent({
  name: 'ConfigureIntegrationDialog',
  
  props: {
    modelValue: {
      type: Boolean,
      required: true,
    },
    selectedIntegration: {
      type: Object as PropType<Integration | null>,
      default: null,
    },
    selectedIntegrationRootFolder: {
      type: String,
      default: '',
    },
    selectedIntegrationEnableWebhooks: {
      type: Boolean,
      default: false,
    },
  },
  
  emits: [
    'update:modelValue',
    'update:selected-integration-root-folder',
    'update:selected-integration-enable-webhooks',
    'save',
    'close',
  ],
  
  setup(props: {
    modelValue: boolean;
    selectedIntegration: Integration | null;
    selectedIntegrationRootFolder: string;
    selectedIntegrationEnableWebhooks: boolean;
  }, { emit }: { emit: (event: string, ...args: any[]) => void }) {
    const dialog = ref(props.modelValue);
    const localRootFolder = ref(props.selectedIntegrationRootFolder);
    const localEnableWebhooks = ref(props.selectedIntegrationEnableWebhooks);
    const loading = ref(false);
    const error = ref('');
    
    // Watch for changes to the dialog state
    watch(() => props.modelValue, (newVal: boolean) => {
      dialog.value = newVal;
      if (newVal) {
        // Reset form when dialog opens
        localRootFolder.value = props.selectedIntegrationRootFolder;
        localEnableWebhooks.value = props.selectedIntegrationEnableWebhooks;
        error.value = '';
      }
    });
    
    // Update parent when local values change
    watch(() => localRootFolder.value, (newVal: string) => {
      emit('update:selected-integration-root-folder', newVal);
    });
    
    watch(() => localEnableWebhooks.value, (newVal: boolean) => {
      emit('update:selected-integration-enable-webhooks', newVal);
    });
    
    const close = () => {
      dialog.value = false;
      emit('update:modelValue', false);
      emit('close');
    };
    
    const save = async () => {
      if (!props.selectedIntegration) return;
      
      loading.value = true;
      error.value = '';
      
      try {
        // Emit save event with the updated configuration
        emit('save', {
          id: props.selectedIntegration.id,
          rootFolder: localRootFolder.value,
          enableWebhooks: localEnableWebhooks.value,
        });
        
        close();
      } catch (err) {
        error.value = err instanceof Error ? err.message : 'Failed to save configuration';
        console.error('Error saving integration configuration:', err);
      } finally {
        loading.value = false;
      }
    };
    
    // Update dialog visibility when modelValue changes
    watch(() => props.modelValue, (newVal) => {
      dialog.value = newVal;
    });
    
    // Emit update when dialog is closed
    watch(dialog, (newVal: boolean) => {
      if (!newVal) {
        close();
      }
    });
    
    return {
      dialog,
      localRootFolder,
      localEnableWebhooks,
      loading,
      error,
      close,
      save,
    };
  },
});
</script>
