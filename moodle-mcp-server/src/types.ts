export enum ResponseFormat {
  MARKDOWN = "markdown",
  JSON = "json",
}

export interface MoodleCourse {
  id: number;
  shortname: string;
  fullname: string;
  displayname?: string;
  idnumber?: string;
  summary?: string;
  categoryid?: number;
  visible?: number;
}

export interface MoodleCourseSection {
  id: number;
  name: string;
  visible: number;
  summary?: string;
  modules: MoodleCourseModule[];
}

export interface MoodleCourseModule {
  id: number;
  name: string;
  modname: string; // 'resource', 'page', 'scorm', 'quiz', etc.
  modicon?: string;
  url?: string;
  visible: number;
  description?: string;
  contents?: Array<{
    filename?: string;
    fileurl?: string;
    content?: string;
  }>;
}

export interface MoodleEnrolledCourse {
  id: number;
  shortname: string;
  fullname: string;
  progress?: number;
}

export interface MoodleActivityCompletionStatus {
  cmid: number;
  modname: string;
  instance: number;
  state: number; // 0 = incompleto, 1 = completo, 2 = completo (aprobado), 3 = completo (suspenso)
  timecompleted: number;
}

export interface MoodlePage {
  coursemodule: number;
  id: number;
  course: number;
  name: string;
  intro?: string;
  content?: string;
  contentformat?: number;
}

export interface MoodleResource {
  id: number;
  coursemodule: number;
  course: number;
  name: string;
  intro?: string;
  contentfiles?: Array<{
    filename: string;
    fileurl: string;
  }>;
}

export interface MoodleScorm {
  id: number;
  coursemodule: number;
  course: number;
  name: string;
  intro?: string;
}
