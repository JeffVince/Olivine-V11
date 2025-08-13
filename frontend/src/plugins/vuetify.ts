import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import { createVuetify, ThemeDefinition } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

const lightTheme: ThemeDefinition = {
  dark: false,
  colors: {
    primary: '#3B82F6',
    secondary: '#10B981',
    accent: '#8B5CF6',
    error: '#EF4444',
    info: '#0EA5E9',
    success: '#22C55E',
    warning: '#F59E0B'
  }
}

const darkTheme: ThemeDefinition = {
  dark: true,
  colors: {
    primary: '#60A5FA',
    secondary: '#34D399',
    accent: '#A78BFA',
    error: '#F87171',
    info: '#38BDF8',
    success: '#4ADE80',
    warning: '#FBBF24'
  }
}

const vuetify = createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: 'dark',
    themes: {
      light: lightTheme,
      dark: darkTheme
    }
  }
})

export default vuetify


