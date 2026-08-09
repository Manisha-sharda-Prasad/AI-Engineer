// Public, read-only GitHub repositories displayed by Learning Notes.
// Do not add GitHub tokens here: everything in frontend code is public.
export const NOTE_REPOSITORIES = [
  {
    id: 'senior-system-engineer',
    owner: 'lekhrajdinkar',
    repo: 'senior-system-engineer',
    branch: 'main',
    path: 'docs',
    name: 'Senior System Engineer',
    description: 'Architecture, cloud, DevOps, and senior engineering notes.',
  },
  {
    id: 'ai-engineer',
    owner: 'lekhrajdinkar',
    repo: 'AI-Engineer',
    branch: 'main',
    path: 'docs',
    name: 'AI Engineer',
    description: 'Generative AI, agents, RAG, protocols, and AI engineering notes.',
  },
  {
    id: 'microservice-java',
    owner: 'lekhrajdinkar',
    repo: 'microservice-java',
    branch: 'main',
    path: 'docs',
    name: 'Microservice Java',
    description: 'Java, Spring, and microservice engineering notes.',
  },
  {
    id: 'microservice-python',
    owner: 'lekhrajdinkar',
    repo: 'microservice-python',
    branch: 'main',
    path: 'docs',
    name: 'Microservice Python',
    description: 'Python and Python microservice engineering notes.',
  },
  {
    id: 'cloud-engineering',
    owner: 'Manisha-sharda-Prasad',
    repo: 'cloud-engineering',
    branch: 'main',
    path: 'doc',
    name: 'Cloud Engineering',
    description: 'AWS, cloud foundations, and cloud engineering notes.',
  },
]

export const NOTE_INDEX_CACHE_MS = 5 * 60 * 1000
