import { readdir, readFile, access } from 'fs/promises';
import { join } from 'path';
import matter from 'gray-matter';
import type { SkillMeta } from './skill-types';

export class SkillRegistry {
  private skills = new Map<string, SkillMeta>();

  async discover(skillsDir: string): Promise<void> {
    const entries = await readdir(skillsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === 'shared') continue;

      const skillDir = join(skillsDir, entry.name);
      const skillMdPath = join(skillDir, 'SKILL.md');

      try {
        await access(skillMdPath);
      } catch {
        continue;
      }

      const content = await readFile(skillMdPath, 'utf-8');
      const meta = this.parseSkillMd(content, entry.name, skillDir);
      this.skills.set(meta.name, meta);
    }
  }

  private parseSkillMd(content: string, dirName: string, skillDir: string): SkillMeta {
    const parsed = matter(content);

    return {
      name: parsed.data.name ?? dirName,
      description: parsed.data.description ?? '',
      license: parsed.data.license,
      body: parsed.content.trim(),
      skillDir,
      hasReference: false,
      hasScripts: false,
      hasAgents: false,
    };
  }

  get(name: string): SkillMeta | undefined {
    return this.skills.get(name);
  }

  list(): SkillMeta[] {
    return Array.from(this.skills.values());
  }

  has(name: string): boolean {
    return this.skills.has(name);
  }

  getNames(): string[] {
    return Array.from(this.skills.keys());
  }
}

let globalRegistry: SkillRegistry | null = null;

export async function getSkillRegistry(): Promise<SkillRegistry> {
  if (globalRegistry) return globalRegistry;

  globalRegistry = new SkillRegistry();
  const skillsDir = join(process.cwd(), 'src', 'skills');
  await globalRegistry.discover(skillsDir);
  return globalRegistry;
}

export function resetSkillRegistry(): void {
  globalRegistry = null;
}
