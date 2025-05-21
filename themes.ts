import { DefaultTheme, DarkTheme, Theme } from '@react-navigation/native'

const EIST_GREEN = '#AFFC41'
const EIST_PURPLE = '#4733FF'

export const EistLightTheme: Theme = {
  ...DefaultTheme,
  colors: {
    primary: EIST_GREEN,
    background: EIST_PURPLE,
    card: EIST_PURPLE,
    text: EIST_GREEN,
    border: EIST_PURPLE,
    notification: EIST_GREEN,
  },
}

export const EistDarkTheme: Theme = {
  ...DarkTheme,
  colors: {
    primary: EIST_GREEN,
    background: EIST_PURPLE,
    card: EIST_PURPLE,
    text: EIST_GREEN,
    border: EIST_PURPLE,
    notification: EIST_GREEN,
  },
}
