import { describe, it, expect, beforeEach } from 'vitest';
import { SkillRegistry } from '@/core/skill-registry';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('SkillRegistry', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `skill-registry-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  it('discovers skills from directory with SKILL.md', async () => {
    const skillDir = join(testDir, 'test-skill');
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      join(skillDir, 'SKILL.md'),
      `---
name: test-skill
description: A test skill for unit testing.
---

# Test Skill

This is a test skill body.
`
    );

    const registry = new SkillRegistry();
    await registry.discover(testDir);

    const skills = registry.list();
    expect(skills.length).toBe(1);
    expect(skills[0].name).toBe('test-skill');
    expect(skills[0].description).toContain('test skill');
    expect(skills[0].body).toContain('Test Skill');
  });

  it('skips directories without SKILL.md', async () => {
    const skillDir = join(testDir, 'no-skill-md');
    await mkdir(skillDir, { recursive: true });
    await writeFile(join(skillDir, 'README.md'), '# Not a skill');

    const registry = new SkillRegistry();
    await registry.discover(testDir);

    expect(registry.list().length).toBe(0);
  });

  it('skips "shared" directory', async () => {
    const sharedDir = join(testDir, 'shared');
    await mkdir(sharedDir, { recursive: true });
    await writeFile(
      join(sharedDir, 'SKILL.md'),
      `---\nname: shared\ndescription: Shared resources\n---\n# Shared`
    );

    const registry = new SkillRegistry();
    await registry.discover(testDir);

    expect(registry.list().length).toBe(0);
  });

  it('has() returns correct results', async () => {
    const skillDir = join(testDir, 'my-skill');
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      join(skillDir, 'SKILL.md'),
      `---\nname: my-skill\ndescription: My skill\n---\n# My Skill`
    );

    const registry = new SkillRegistry();
    await registry.discover(testDir);

    expect(registry.has('my-skill')).toBe(true);
    expect(registry.has('nonexistent')).toBe(false);
  });

  it('getNames() returns all skill names', async () => {
    for (const name of ['alpha', 'beta']) {
      const skillDir = join(testDir, name);
      await mkdir(skillDir, { recursive: true });
      await writeFile(
        join(skillDir, 'SKILL.md'),
        `---\nname: ${name}\ndescription: ${name} skill\n---\n# ${name}`
      );
    }

    const registry = new SkillRegistry();
    await registry.discover(testDir);

    const names = registry.getNames();
    expect(names).toContain('alpha');
    expect(names).toContain('beta');
  });

  it('parses SKILL.md frontmatter correctly', async () => {
    const skillDir = join(testDir, 'complex-skill');
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      join(skillDir, 'SKILL.md'),
      `---
name: complex-skill
description: "A complex skill with special chars: <>&"
license: MIT
---

# Complex Skill

## Section 1
Content here.

## Section 2
More content.
`
    );

    const registry = new SkillRegistry();
    await registry.discover(testDir);

    const skill = registry.get('complex-skill');
    expect(skill).toBeDefined();
    expect(skill!.license).toBe('MIT');
    expect(skill!.body).toContain('Section 1');
    expect(skill!.body).toContain('Section 2');
    expect(skill!.skillDir).toBe(skillDir);
  });
});
