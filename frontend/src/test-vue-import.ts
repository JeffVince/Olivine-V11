import { ref } from 'vue'
import type { Ref } from 'vue'

console.log('Vue import test successful')

const testRef: Ref<string> = ref('test')
console.log('Ref test:', testRef.value)
