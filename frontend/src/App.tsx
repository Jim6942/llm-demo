import { useState, useRef, useEffect, type ChangeEvent, type KeyboardEvent } from 'react'
import './App.css'

type Message = {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

function App() {
  // -- STATE --
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  
  // File state
  const [fileName, setFileName] = useState<string | null>(null)
  const [docText, setDocText] = useState<string>("")

  // Auto-scroll ref
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 1. Handle PDF Upload
  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Simple validation
    if (file.type !== 'application/pdf') {
      alert("Error: Only PDF files are supported.")
      return
    }

    console.log("Uploading file:", file.name)
    setFileName(file.name)
    setIsLoading(true)

    const formData = new FormData()
    formData.append("file", file)

    try {
      const response = await fetch('http://127.0.0.1:8000/upload-pdf', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`)
      }

      const data = await response.json()
      console.log("Upload success:", data)
      
      setDocText(data.text)
      
      setMessages(prev => [...prev, { 
        role: 'system', 
        content: `System: Successfully loaded "${file.name}". You can now ask questions about it.` 
      }])

    } catch (error) {
      console.error("Upload error:", error)
      alert("Failed to upload. Is the Python backend running?")
      setFileName(null)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = input
    setInput("")
    
    const newHistory: Message[] = [...messages, { role: 'user', content: userMessage }]
    setMessages(newHistory)
    setIsLoading(true)

    try {
      console.log("Sending to AI...")
      const response = await fetch('http://127.0.0.1:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newHistory,
          document_text: docText
        })
      })

      if (!response.ok) {
        throw new Error("Chat API failed")
      }

      const data = await response.json()
      
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])

    } catch (error) {
      console.error("Chat error:", error)
      setMessages(prev => [...prev, { role: 'system', content: "Error: Could not reach the AI. Check your backend terminal." }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend()
    }
  }

  return (
    <div className="container">
      <header className="header">
        <h1>AI Drafting Sandbox</h1>
        <p>Experimental prototype for document analysis.</p>
        <div className="disclaimer">Note: Student prototype. Do not upload sensitive real-world data.</div>
      </header>

      <div className="workspace">
        
        <div className="left-panel">
          <h3>Context</h3>
          
          <div className="file-section">
            {!fileName ? (
              <div className="upload-placeholder">
                <p>No document loaded.</p>
                <label className="upload-btn">
                  Upload PDF
                  <input 
                    type="file" 
                    accept=".pdf" 
                    onChange={handleFileChange} 
                    hidden 
                  />
                </label>
              </div>
            ) : (
              <div className="file-card">
                <div className="icon">📄</div>
                <div className="info">
                  <strong>{fileName}</strong>
                  <span>Ready for questions</span>
                </div>
              </div>
            )}
          </div>
          
          <div className="debug-info">
            <p>Backend Status: {docText ? "Linked ✅" : "Waiting for file..."}</p>
          </div>
        </div>

        <div className="chat-panel">
          
          <div className="chat-history">
            {messages.length === 0 && (
              <div className="empty-state">
                <p>👋 Welcome! Upload a PDF to the left, then ask me to summarize it or draft a reply.</p>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div key={idx} className={`message ${msg.role}`}>
                {msg.role === 'assistant' && <strong>AI: </strong>}
                {msg.role === 'user' && <strong>You: </strong>}
                {msg.content}
              </div>
            ))}
            
            {isLoading && <div className="message system">Thinking...</div>}
            
            <div ref={bottomRef} />
          </div>

          <div className="input-area">
            <input
              type="text"
              placeholder="Ask about the document..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
            />
            <button onClick={handleSend} disabled={isLoading || !input.trim()}>
              Send
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}

export default App