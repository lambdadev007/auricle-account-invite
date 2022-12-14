const timer = ms => new Promise(res => setTimeout(res, ms))

const handler = async () => {
    try {
      for (var i = 0; i < 1000; i++) {
        console.log(i)
        if (i > 99 && i % 100 === 0) {
          await timer(1 * 5 * 1000)
        }
      }
      
      return "All done"
    } catch (error) {
      console.log('[error]', error)
      return error
    }
}

handler()