/**
 * GitHub Comment Generator
 * 
 * Generates professional GitHub comments with analysis results
 * for posting to PR feedback.
 */

class CommentGenerator {
  /**
   * Generate GitHub comment from job analysis
   * @param {Object} job - Job with analysis results
   * @param {Object} analysis - Analysis result from ChaosAnalyzer
   * @returns {string} Markdown formatted comment
   */
  generateComment(job, analysis) {
    const verdict = this.getVerdictEmoji(analysis.verdict) + ` **${analysis.verdict}**`;
    
    let comment = `## FLUX AI Chaos Reviewer\n\n`;
    comment += `${verdict} | Confidence: ${analysis.confidence}%\n\n`;
    
    // Verdict explanation
    comment += this.generateVerdictSection(analysis);
    
    // Performance metrics
    comment += this.generateMetricsSection(analysis, job);
    
    // Chaos event summary
    comment += this.generateChaosSection(analysis, job);
    
    // Strengths
    if (analysis.strengths.length > 0) {
      comment += `### ✨ Strengths\n\n`;
      analysis.strengths.forEach(strength => {
        comment += `- ${strength}\n`;
      });
      comment += `\n`;
    }
    
    // Recommendations
    if (analysis.recommendations.length > 0) {
      comment += `### 💡 Recommendations\n\n`;
      analysis.recommendations.forEach(rec => {
        comment += `- ${rec}\n`;
      });
      comment += `\n`;
    }
    
    // Code changes (if available)
    if (job.codeChanges) {
      comment += this.generateCodeSection(job.codeChanges);
    }
    
    // Footer
    comment += `---\n`;
    comment += `*FLUX AI Chaos Testing | `;
    comment += `[Dashboard](https://flux.company.com) | `;
    comment += `[Docs](https://docs.flux.company.com)*\n`;
    
    return comment;
  }

  /**
   * Generate markdown tables for metrics
   */
  generateMetricsSection(analysis, job) {
    let section = `### 📊 Performance Metrics\n\n`;
    
    if (Object.keys(analysis.metrics).length === 0) {
      return section + `No metrics available\n\n`;
    }

    // Create table
    section += `| Metric | Value | Threshold | Status |\n`;
    section += `|--------|-------|-----------|--------|\n`;

    // P99 Latency
    if (analysis.metrics.p99Latency) {
      const status = analysis.metrics.p99Latency.status === 'OK' ? '✅' : '⚠️';
      section += `| P99 Latency | ${analysis.metrics.p99Latency.value}ms | ${analysis.metrics.p99Latency.threshold}ms | ${status} |\n`;
    }

    // Error Rate
    if (analysis.metrics.errorRate) {
      const status = analysis.metrics.errorRate.status === 'OK' ? '✅' : '⚠️';
      section += `| Error Rate | ${analysis.metrics.errorRate.value}% | ${analysis.metrics.errorRate.threshold}% | ${status} |\n`;
    }

    // Throughput
    if (analysis.metrics.throughput) {
      const status = analysis.metrics.throughput.status === 'OK' ? '✅' : '⚠️';
      section += `| Throughput | ${analysis.metrics.throughput.value} RPS | ${analysis.metrics.throughput.threshold} RPS | ${status} |\n`;
    }

    // Memory
    if (analysis.metrics.memory) {
      const status = analysis.metrics.memory.status === 'OK' ? '✅' : '⚠️';
      section += `| Memory | ${analysis.metrics.memory.value}% | ${analysis.metrics.memory.threshold}% | ${status} |\n`;
    }

    // DB Pool
    if (analysis.metrics.dbPool) {
      const status = analysis.metrics.dbPool.status === 'OK' ? '✅' : '⚠️';
      section += `| DB Pool | ${analysis.metrics.dbPool.used}/${analysis.metrics.dbPool.limit} | ${analysis.metrics.dbPool.limit} | ${status} |\n`;
    }

    section += `\n`;
    return section;
  }

  /**
   * Generate chaos events summary
   */
  generateChaosSection(analysis, job) {
    let section = `### ⚡ Chaos Events (${job.chaosEvents?.length || 0} types tested)\n\n`;

    if (!job.chaosEvents || job.chaosEvents.length === 0) {
      return section + `No chaos events recorded\n\n`;
    }

    section += `| Event Type | Count | Impact | Resilience |\n`;
    section += `|------------|-------|--------|------------|\n`;

    job.chaosEvents.forEach(event => {
      const resilience = analysis.chaosResilience[event.eventType];
      if (!resilience) return;

      const impactEmoji = {
        'LOW': '✅',
        'MEDIUM': '⚠️',
        'HIGH': '❌'
      }[event.impact] || event.impact;

      section += `| ${event.eventType} | ${event.eventCount} | ${impactEmoji} ${event.impact} | ${resilience.resilient ? '✅ Resilient' : '⚠️ Vulnerable'} |\n`;
    });

    section += `\n`;
    return section;
  }

  /**
   * Generate code changes section
   */
  generateCodeSection(codeChanges) {
    if (!codeChanges || !codeChanges.before) {
      return '';
    }

    let section = `### 📝 Code Changes\n\n`;
    
    if (codeChanges.summary) {
      section += `**${codeChanges.summary}**\n\n`;
    }

    section += `**File:** \`${codeChanges.fileName}\`\n\n`;
    
    section += `**Before:**\n`;
    section += `\`\`\`javascript\n${codeChanges.before}\n\`\`\`\n\n`;
    
    section += `**After:**\n`;
    section += `\`\`\`javascript\n${codeChanges.after}\n\`\`\`\n\n`;
    
    return section;
  }

  /**
   * Generate verdict explanation
   */
  generateVerdictSection(analysis) {
    let section = `### Verdict Explanation\n\n`;

    switch (analysis.verdict) {
      case 'SAFE_TO_MERGE':
        section += `✅ This PR passed chaos testing with strong resilience and no critical issues detected.\n\n`;
        break;
      case 'NEEDS_REVIEW':
        section += `⚠️ This PR has some concerns that should be reviewed before merging:\n\n`;
        if (analysis.recommendations.length > 0) {
          section += `**Issues to address:**\n`;
          analysis.recommendations.slice(0, 3).forEach(rec => {
            section += `- ${rec}\n`;
          });
          section += `\n`;
        }
        break;
      case 'UNSAFE':
        section += `❌ This PR has critical issues that must be addressed before merging:\n\n`;
        if (analysis.recommendations.length > 0) {
          section += `**Critical issues:**\n`;
          analysis.recommendations.slice(0, 3).forEach(rec => {
            section += `- **${rec}**\n`;
          });
          section += `\n`;
        }
        break;
    }

    section += `**Confidence:** ${analysis.confidence}% (based on ${analysis.reasoning.length} test signals)\n\n`;
    return section;
  }

  /**
   * Generate quick verdict emoji
   */
  getVerdictEmoji(verdict) {
    const emojis = {
      'SAFE_TO_MERGE': '✅',
      'NEEDS_REVIEW': '⚠️',
      'UNSAFE': '❌'
    };
    return emojis[verdict] || '❓';
  }

  /**
   * Generate approval comment (when safe to merge)
   */
  generateApprovalComment(job, analysis) {
    let comment = `### 🎉 Ready to Merge!\n\n`;
    comment += `This PR successfully passed FLUX chaos testing.\n\n`;
    
    comment += `**Summary:**\n`;
    comment += `- Tested against 23 chaos scenarios\n`;
    comment += `- All performance metrics within thresholds\n`;
    comment += `- ${analysis.strengths.length} key strengths identified\n\n`;
    
    if (analysis.strengths.length > 0) {
      comment += `**Highlights:**\n`;
      analysis.strengths.forEach(s => {
        comment += `- ${s}\n`;
      });
      comment += `\n`;
    }

    comment += `You can safely merge this PR! 🚀\n`;
    return comment;
  }

  /**
   * Generate rejection comment (when unsafe)
   */
  generateRejectionComment(job, analysis) {
    let comment = `### 🛑 Cannot Merge - Critical Issues\n\n`;
    comment += `This PR has critical issues detected during chaos testing that must be resolved:\n\n`;
    
    if (analysis.recommendations.length > 0) {
      comment += `**Required Actions:**\n`;
      analysis.recommendations.forEach(rec => {
        comment += `1. ${rec}\n`;
      });
      comment += `\n`;
    }

    comment += `Once you've addressed these issues, please push updates and we'll re-test automatically.\n`;
    return comment;
  }
}

module.exports = CommentGenerator;
