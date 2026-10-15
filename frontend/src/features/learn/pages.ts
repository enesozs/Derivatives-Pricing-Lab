import { lazy } from 'react'

export const loadCourse = () => import('./course-page')
export const loadChapter = () => import('./chapter-page')
export const loadStart = () => import('./start-page')
export const loadGlossary = () => import('./glossary-page')

export const CoursePage = lazy(loadCourse)
export const ChapterPage = lazy(loadChapter)
export const StartPage = lazy(loadStart)
export const GlossaryPage = lazy(loadGlossary)
