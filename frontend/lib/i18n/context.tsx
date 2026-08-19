'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  translations,
  type Language,
} from './translations'


type LanguageContextValue = {
  language: Language
  setLanguage: (language: Language) => void
  toggleLanguage: () => void
  t: typeof translations.en
  isArabic: boolean
}


const LanguageContext =
  createContext<LanguageContextValue | null>(null)


export function LanguageProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [language, setLanguageState] =
    useState<Language>('en')


  useEffect(() => {
    const savedLanguage =
      window.localStorage.getItem(
        'proposal-portal-language',
      ) as Language | null


    if (
      savedLanguage === 'en' ||
      savedLanguage === 'ar'
    ) {
      setLanguageState(savedLanguage)
    }
  }, [])


  useEffect(() => {
    const isArabic =
      language === 'ar'


    document.documentElement.lang =
      language

    document.documentElement.dir =
      isArabic
        ? 'rtl'
        : 'ltr'

    window.localStorage.setItem(
      'proposal-portal-language',
      language,
    )
  }, [language])


  function setLanguage(
    nextLanguage: Language,
  ) {
    setLanguageState(
      nextLanguage,
    )
  }


  function toggleLanguage() {
    setLanguageState(
      (currentLanguage) =>
        currentLanguage === 'en'
          ? 'ar'
          : 'en',
    )
  }


  const value =
    useMemo<LanguageContextValue>(
      () => ({
        language,
        setLanguage,
        toggleLanguage,
        t: translations[language],
        isArabic:
          language === 'ar',
      }),
      [language],
    )


  return (
    <LanguageContext.Provider
      value={value}
    >
      {children}
    </LanguageContext.Provider>
  )
}


export function useLanguage() {
  const context =
    useContext(
      LanguageContext,
    )


  if (!context) {
    throw new Error(
      'useLanguage must be used within a LanguageProvider',
    )
  }


  return context
}