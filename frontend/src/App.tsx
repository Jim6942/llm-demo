import { useState, useRef, useEffect, type ChangeEvent, type KeyboardEvent, type DragEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import './App.css'

type Message = {
  role: 'user' | 'assistant' | 'system'
  content: string
}

type Doc = {
  name: string
  text: string
}

function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [documents, setDocuments] = useState<Doc[]>([])
  
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const uploadFile = async (file: File) => {
    const formData = new FormData()
    formData.append("file", file)

    try {
      const res = await fetch('http://127.0.0.1:8000/upload-pdf', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) throw new Error("Upload failed")
      
      const data = await res.json()
      
      setDocuments(prev => [...prev, { name: data.filename, text: data.text }])
      
      setMessages(prev => [...prev, { 
        role: 'system', 
        content: `**System:** Loaded "${data.filename}" successfully.` 
      }])
    } catch (error) {
      console.error(error)
      alert(`Error uploading ${file.name}`)
    }
  }

  const handleDrop = async (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setIsLoading(true)
      const files = Array.from(e.dataTransfer.files)
      
      for (const file of files) {
        if (file.type === 'application/pdf') {
          await uploadFile(file)
        }
      }
      setIsLoading(false)
    }
  }

  const handleDragOver = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    setIsLoading(true)
    const files = Array.from(e.target.files)
    
    for (const file of files) {
      if (file.type === 'application/pdf') {
        await uploadFile(file)
      }
    }
    setIsLoading(false)
  }

  const removeDoc = (indexToRemove: number) => {
    setDocuments(prev => prev.filter((_, idx) => idx !== indexToRemove))
  }

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMsg = input
    setInput("")
    
    const newHistory: Message[] = [...messages, { role: 'user', content: userMsg }]
    setMessages(newHistory)
    setIsLoading(true)

    const fullContext = documents.map(d => d.text).join("\n\n")

    try {
      const res = await fetch('http://127.0.0.1:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newHistory,
          document_text: fullContext
        })
      })

      if (!res.ok) throw new Error("Chat failed")
      
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])

    } catch (error) {
      console.error(error)
      setMessages(prev => [...prev, { role: 'system', content: "Error connecting to server." }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSend()
  }

  return (
    <div className="app-container">
      <nav className="navbar">
        <div className="logo">Revax <span className="tag">Sandbox</span></div>
      </nav>

      <div className="main-content">
        <div className="hero">
          <h1>AI-powered drafting <br/> <span className="gradient-text">for your documents.</span></h1>
          <p className="subtitle">Experimental prototype. Upload PDFs to analyze, summarize, or draft new content based on your knowledge.</p>
        </div>

        <div className="workspace-grid">
          <div className="panel left-panel">
            <div className="panel-header">
              <h3>Document Context ({documents.length})</h3>
            </div>
            
            <div className="file-upload-area">
              <label 
                className="upload-zone"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              >
                <div className="icon">📂</div>
                <span>Drag & Drop PDFs</span>
                <small>or click to browse</small>
                <input type="file" accept=".pdf" multiple onChange={handleFileChange} hidden />
              </label>

              <div className="file-list">
                {documents.map((doc, idx) => (
                  <div key={idx} className="active-file-card">
                    <div className="file-icon">📄</div>
                    <div className="file-info">
                      <strong>{doc.name}</strong>
                    </div>
                    <button className="remove-btn" onClick={() => removeDoc(idx)}>×</button>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="tips">
              <strong>Try asking:</strong>
              <ul>
                <li>"Summarize these documents"</li>
                <li>"Compare the key points"</li>
                <li>"Draft an email based on this"</li>
              </ul>
            </div>
          </div>

          <div className="panel chat-panel">
            <div className="messages-list">
              {messages.length === 0 && (
                 <div className="empty-chat-state">
                    <div className="ai-avatar">✨</div>
                    <p>Ready. Upload documents to the left to give me context.</p>
                 </div>
              )}

              {messages.map((msg, idx) => (
                <div key={idx} className={`message-row ${msg.role}`}>
                  <div className="bubble">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="message-row assistant">
                   <div className="bubble loading">
                      <span className="dot">.</span><span className="dot">.</span><span className="dot">.</span>
                   </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div className="input-container">
              <input 
                type="text" 
                placeholder="Ask something..." 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
              />
              <button onClick={handleSend} disabled={isLoading || !input.trim()}>
                ↑
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App