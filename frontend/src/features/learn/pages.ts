import { lazy } from 'react'

export const loadCourse = () => import('./course-page')
export const loadChapter = () => import('./chapter-page')

export const CoursePage = lazy(loadCourse)
export const ChapterPage = lazy(loadChapter)
