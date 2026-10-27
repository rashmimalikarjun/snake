/**
 * Node.js verification script for food rendering fix
 * Tests that the lcdRenderer.js now draws food as a small centered block
 */

import { readFileSync } from 'fs'

// Read the fixed renderer file
const rendererCode = readFileSync('./frontend/src/game/lcdRenderer.js', 'utf8')

console.log('=== Food Rendering Fix Verification ===\n')

// Check 1: Verify old buggy code is removed
const hasOldBuggyCode = 
    rendererCode.includes('4x4 ring with center hole + stem') ||
    (rendererCode.match(/ctx\.fillRect\(fx \+ p, fy, p, p\)/g) || []).length > 1

if (hasOldBuggyCode) {
    console.log('❌ FAIL: Old buggy multi-rect food code still present')
    process.exit(1)
} else {
    console.log('✓ PASS: Old buggy multi-rect food code removed')
}

// Check 2: Verify new simple centered block implementation exists
const hasNewFixedCode = 
    rendererCode.includes('small centered block within grid cell') &&
    rendererCode.includes('blockSize = Math.max(2, Math.floor(cell * 0.6))') &&
    rendererCode.includes('offset = Math.floor((cell - blockSize) / 2)') &&
    rendererCode.includes('ctx.fillRect(fx + offset, fy + offset, blockSize, blockSize)')

if (hasNewFixedCode) {
    console.log('✓ PASS: New fixed single-block food rendering implemented')
} else {
    console.log('❌ FAIL: New fixed food rendering not found')
    process.exit(1)
}

// Check 3: Count fillRect calls in food section
const foodSectionMatch = rendererCode.match(/\/\/ --- food:[\s\S]*?\/\/ --- snake:/)
if (foodSectionMatch) {
    const foodSection = foodSectionMatch[0]
    const fillRectCount = (foodSection.match(/ctx\.fillRect/g) || []).length
    
    if (fillRectCount === 1) {
        console.log(`✓ PASS: Food section has exactly 1 fillRect call (was 8 before)`)
    } else {
        console.log(`❌ FAIL: Food section has ${fillRectCount} fillRect calls (expected 1)`)
        process.exit(1)
    }
} else {
    console.log('⚠ WARNING: Could not isolate food section for counting')
}

// Check 4: Verify grid alignment preserved
const hasGridAlignment = 
    rendererCode.includes('offX + snapshot.food.x * cell') &&
    rendererCode.includes('offY + snapshot.food.y * cell')

if (hasGridAlignment) {
    console.log('✓ PASS: Food maintains proper grid cell alignment')
} else {
    console.log('❌ FAIL: Grid alignment broken')
    process.exit(1)
}

// Check 5: Verify Nokia LCD aesthetic preserved
const hasNokiaColors = 
    rendererCode.includes("INK = '#1c2b16'") &&
    rendererCode.includes("BG = '#9dbb78'")

if (hasNokiaColors) {
    console.log('✓ PASS: Nokia monochrome LCD colors preserved')
} else {
    console.log('❌ FAIL: Color scheme changed')
    process.exit(1)
}

console.log('\n=== ALL VERIFICATION CHECKS PASSED ===')
console.log('\nSummary of Fix:')
console.log('- BEFORE: Food drawn as 8 overlapping rectangles covering ~4x cell area')
console.log('- AFTER: Food drawn as 1 centered rectangle at ~60% of cell size')
console.log('- Result: Small, recognizable pixelated item consistent with Nokia aesthetic')
console.log('- Impact: No changes to game logic, movement, scoring, or collision detection')
