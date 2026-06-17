import { describe, it, expect } from 'vitest';
import { SkillRegistry } from '@/core/skill-registry';
import { join } from 'path';

describe('Skill Discovery - Real Skills', () => {
  it('discovers all 6 skills in the project', async () => {
    const registry = new SkillRegistry();
    const skillsDir = join(process.cwd(), 'src', 'skills');
    await registry.discover(skillsDir);

    const names = registry.getNames();
    expect(names).toContain('query-understand');
    expect(names).toContain('authority-evaluate');
    expect(names).toContain('content-fetch');
    expect(names).toContain('summarize');
    expect(names).toContain('translate');
    expect(names).toContain('trend-analyze');
  });

  it('each skill has valid frontmatter', async () => {
    const registry = new SkillRegistry();
    const skillsDir = join(process.cwd(), 'src', 'skills');
    await registry.discover(skillsDir);

    for (const skill of registry.list()) {
      expect(skill.name).toBeTruthy();
      expect(skill.description.length).toBeGreaterThan(10);
      expect(skill.body.length).toBeGreaterThan(50);
    }
  });

  it('each skill description contains trigger info', async () => {
    const registry = new SkillRegistry();
    const skillsDir = join(process.cwd(), 'src', 'skills');
    await registry.discover(skillsDir);

    for (const skill of registry.list()) {
      expect(skill.description.toLowerCase()).toMatch(/use when|use for|trigger/);
    }
  });
});
