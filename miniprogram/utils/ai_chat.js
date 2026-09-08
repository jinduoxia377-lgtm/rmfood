// AI Chat Module - Optimized with Structured Response Format
const request = require('./request.js')

class AIChat {
  constructor() {
    this.currentSessionId = null
    this.messages = []
    this.isStreaming = false
    this.onChunkCallback = null
    this.backendAvailable = false
  }

  async checkBackend() {
    try {
      const res = await request.get('/health')
      this.backendAvailable = true
      return true
    } catch (error) {
      this.backendAvailable = false
      return false
    }
  }

  async createSession() {
    try {
      const res = await request.post('/ai/chat/session')
      this.currentSessionId = res.sessionId || this.generateSessionId()
      this.messages = []
      return {
        sessionId: this.currentSessionId,
        welcomeMessage: 'Hello! I am RMFOOD AI dietary consultant. Please tell me your health goals or symptoms.'
      }
    } catch (error) {
      this.currentSessionId = this.generateSessionId()
      this.messages = []
      return {
        sessionId: this.currentSessionId,
        welcomeMessage: 'Hello! I am RMFOOD AI dietary consultant. Please tell me your health goals or symptoms.'
      }
    }
  }

  async sendMessage(message, onChunk) {
    if (!this.currentSessionId) {
      await this.createSession()
    }

    this.isStreaming = true
    this.onChunkCallback = onChunk || null
    this.messages.push({ role: 'user', content: message })

    try {
      const response = await request.post('/ai/chat/stream', {
        session_id: this.currentSessionId,
        message: message,
        stream: true
      }, { timeout: 30000 })

      this.isStreaming = false

      if (response.success || response.code === 200) {
        var data = response.data
        var reply = (data && data.content) || response.reply || ''
        var formula = (data && data.formula) || null
        var structuredData = (data && data.structured) || null

        if (this.onChunkCallback && reply) {
          const chunks = this.chunkText(reply, 8)
          for (const chunk of chunks) {
            this.onChunkCallback(chunk)
            await this.sleep(25)
          }
        }

        this.messages.push({
          role: 'assistant',
          content: reply,
          formula: formula,
          structured: structuredData
        })

        return { reply, formula, structured: structuredData, sessionId: this.currentSessionId }
      } else {
        throw new Error(response.message || 'Chat failed')
      }
    } catch (error) {
      console.log('[AIChat] Using local simulated reply')
      const reply = this.generateLocalReply(message)
      const structured = this.parseStructuredReply(reply)

      this.isStreaming = false

      if (this.onChunkCallback) {
        const chunks = this.chunkText(reply, 5)
        for (const chunk of chunks) {
          this.onChunkCallback(chunk)
          await this.sleep(20)
        }
      }

      this.messages.push({
        role: 'assistant',
        content: reply,
        formula: null,
        structured: structured
      })

      return { reply, formula: null, structured: structured, sessionId: this.currentSessionId }
    }
  }

  generateLocalReply(message) {
    const lowerMsg = message.toLowerCase()

    if (lowerMsg.includes('sleep') || lowerMsg.includes('insomnia') || lowerMsg.includes('night')) {
      return `## Differentiation and Goal

Based on your sleep problems, I identify: **Heart-Kidney Non-Interaction Syndrome** with spirit not being nourished.

## Recommended Formula

**Sour Jujube Decoction for Calming Spirit**

| Ingredient | Amount | Function |
|------------|--------|----------|
| Sour Jujube Kernel | 15g | Nourish heart and calm spirit |
| Poria | 10g | Strengthen spleen and drain dampness |
| Lily Bulb | 10g | Clear heart heat and calm spirit |
| Longan Aril | 5 pieces | Nourish heart and spleen blood |

## Preparation Method

1. Wash all ingredients thoroughly
2. Add 500ml purified water
3. Soak for 30 minutes
4. Decoct on medium heat for 25 minutes
5. Strain and drink warm 1 hour before bedtime

## Mechanism Explanation

- **Sour Jujube Kernel** contains saponins that modulate GABA receptors, promoting relaxation
- **Poria** polysaccharides regulate gut-brain axis through intestinal flora modulation
- **Lily Bulb** alkaloids have mild sedative effects on the central nervous system

## Contraindications

- Pregnant women should use with caution
- Spleen-deficient with loose stools: reduce Poria to 6g
- Not suitable for acute insomnia caused by external pathogens

## Monitoring

Track sleep latency, nighttime awakenings, and morning energy levels over 14 days.`
    }

    if (lowerMsg.includes('spleen') || lowerMsg.includes('digestion') || lowerMsg.includes('bloating') || lowerMsg.includes('appetite')) {
      return `## Differentiation and Goal

Based on your spleen-stomach complaints: **Spleen-Qi Deficiency with Dampness Accumulation**.

## Recommended Formula

**Astragalus and Tangerine Peel Tea**

| Ingredient | Amount | Function |
|------------|--------|----------|
| Astragalus | 15g | Tonify qi and raise yang |
| Chinese Yam | 15g | Strengthen spleen and lungs |
| Poria | 10g | Promote urination and drain dampness |
| Coix Seed | 15g | Strengthen spleen and stop diarrhea |
| Tangerine Peel | 5g | Regulate qi and transform phlegm |

## Preparation Method

1. Wash yam, poria, coix seed
2. Place all ingredients in pot
3. Add 600ml water
4. Bring to boil, then simmer 40 minutes
5. Strain and drink warm, twice daily

## Mechanism Explanation

- **Astragalus** polysaccharides enhance intestinal barrier function via Tight Junction protein upregulation
- **Chinese Yam** mucopolysaccharides protect gastric mucosa and promote motility
- **Coix Seed** triterpenes reduce intestinal inflammation through NF-kB pathway inhibition

## Contraindications

- Spleen-stomach cold type: reduce coix seed to 10g
- During acute illness:暂停服用
- Dry stool with yin deficiency: add Ophiopogon 10g

## Monitoring

Monitor abdominal distension, appetite, stool consistency over 14 days.`
    }

    if (lowerMsg.includes('fatigue') || lowerMsg.includes('weak') || lowerMsg.includes('tired') || lowerMsg.includes('energy')) {
      return `## Differentiation and Goal

Based on fatigue symptoms: **Qi and Blood Deficiency** with mental and physical exhaustion.

## Recommended Formula

**Tonifying Qi and Nourishing Blood Decoction**

| Ingredient | Amount | Function |
|------------|--------|----------|
| Astragalus | 15g | Tonify qi and raise yang |
| Codonopsis | 10g | Tonify middle and boost qi |
| Jujube | 5 pieces | Nourish blood and calm spirit |
| Goji Berry | 10g | Nourish liver and kidney |
| Angelica Sinensis | 6g | Tonify blood and invigorate circulation |

## Preparation Method

1. Wash all ingredients
2. Place in thermos cup
3. Pour 500ml boiling water
4. Steep for 20 minutes
5. Drink as tea throughout the day

## Mechanism Explanation

- **Astragalus** improves mitochondrial function and ATP production
- **Codonopsis** saponins regulate HPA axis to reduce stress response
- **Goji Berry** polysaccharides enhance immune function and reduce oxidative stress

## Contraindications

- Stop during cold or fever
- Hypertension patients: reduce astragalus to 10g
- Diabetes: reduce jujube to 2 pieces

## Monitoring

Track energy levels, exercise tolerance, and sleep quality over 10 days.`
    }

    return `Thank you for your consultation! As RMFOOD AI dietary consultant, I can provide you with personalized medicinal food formula suggestions.

To give you a more accurate plan, please tell me:

1. **Main symptoms**: What discomfort are you experiencing?
2. **Duration**: How long have these symptoms lasted?
3. **Health conditions**: Any other health issues or allergies?
4. **Goals**: What is your调理 objective?

Once you provide this information, I will create a personalized dietary调理 plan based on TCM syndrome differentiation and modern nutritional science.`
  }

  parseStructuredReply(content) {
    try {
      const lines = content.split('\n')
      const structured = {
        section: null,
        formula: null,
        ingredients: [],
        preparation: [],
        mechanism: [],
        contraindications: [],
        monitoring: ''
      }

      let currentSection = ''
      let isTable = false

      for (const line of lines) {
        if (line.startsWith('## ')) {
          currentSection = line.replace('## ', '').trim()
          structured.section = currentSection
          isTable = false
        } else if (line.startsWith('|') && line.includes('|')) {
          isTable = true
          const cells = line.split('|').filter(c => c.trim()).map(c => c.trim())
          if (currentSection === 'Recommended Formula' && cells.length >= 3) {
            structured.ingredients.push({
              name: cells[0],
              amount: cells[1],
              function: cells[2]
            })
          }
        } else if (line.match(/^\d+\./)) {
          if (currentSection === 'Preparation Method') {
            structured.preparation.push(line.replace(/^\d+\.\s*/, ''))
          }
        } else if (line.startsWith('- ')) {
          if (currentSection === 'Mechanism Explanation') {
            structured.mechanism.push(line.replace(/^- /, ''))
          } else if (currentSection === 'Contraindications') {
            structured.contraindications.push(line.replace(/^- /, ''))
          }
        } else if (currentSection === 'Monitoring') {
          structured.monitoring = line
        }
      }

      return structured
    } catch (error) {
      return null
    }
  }

  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
  }

  async chat(message) {
    try {
      const result = await this.sendMessage(message)
      return result
    } catch (error) {
      throw error
    }
  }

  chunkText(text, chunkSize) {
    const chunks = []
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.substring(i, i + chunkSize))
    }
    return chunks
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  getMessages() {
    return this.messages
  }

  clearChat() {
    this.messages = []
    this.currentSessionId = null
  }

  async loadHistory(sessionId) {
    try {
      const res = await request.get('/ai/chat/session/' + sessionId)
      this.currentSessionId = sessionId
      this.messages = res.messages || []
      return this.messages
    } catch (error) {
      const localHistory = wx.getStorageSync('session_' + sessionId)
      if (localHistory) {
        this.messages = localHistory
        this.currentSessionId = sessionId
        return this.messages
      }
      throw error
    }
  }

  async getSessions() {
    try {
      const res = await request.get('/ai/chat/sessions')
      return res.sessions || []
    } catch (error) {
      return wx.getStorageSync('chat_history') || []
    }
  }

  async saveSession(sessionId, messages) {
    try {
      await request.post('/ai/chat/session/save', {
        session_id: sessionId,
        messages: messages
      })
    } catch (error) {
      wx.setStorageSync('session_' + sessionId, messages)
    }
  }
}

module.exports = new AIChat()
